using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace Axis.Desktop;

internal static class Program
{
    private const string InstanceName = "Local\\Axis.Desktop.Instance";

    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var paths = DesktopPaths.Create(args);
        var smokeTest = args.Contains("--smoke-test", StringComparer.OrdinalIgnoreCase);

        using var instance = new Mutex(initiallyOwned: true, InstanceName, out var ownsInstance);
        if (!ownsInstance)
        {
            BrowserLauncher.Open(paths.AppUrl, paths.BrowserProfileDirectory);
            return;
        }

        try
        {
            paths.EnsureDirectories();
            if (!smokeTest && !FirstRunDataImporter.PrepareDatabase(paths))
            {
                return;
            }

            using var backend = BackendProcess.Start(paths);
            backend.WaitUntilReadyAsync(TimeSpan.FromSeconds(35)).GetAwaiter().GetResult();
            if (smokeTest)
            {
                VerifyBundledAppAsync(paths.AppUrl).GetAwaiter().GetResult();
                return;
            }

            using var context = new AxisApplicationContext(paths, backend);
            context.OpenAxis();
            Application.Run(context);
        }
        catch (Exception exception)
        {
            if (smokeTest)
            {
                File.WriteAllText(Path.Combine(paths.LogDirectory, "desktop-smoke.error.log"), exception.ToString());
                Environment.ExitCode = 1;
                return;
            }

            MessageBox.Show(
                $"Axis could not start.\n\n{exception.Message}\n\nLogs: {paths.LogDirectory}",
                "Axis startup failed",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private static async Task VerifyBundledAppAsync(string appUrl)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var html = await client.GetStringAsync(appUrl);
        if (!html.Contains("<div id=\"root\"></div>", StringComparison.Ordinal))
        {
            throw new InvalidDataException("The bundled Axis frontend did not load.");
        }

        using var response = await client.GetAsync($"{appUrl}/api/backup/status");
        response.EnsureSuccessStatusCode();
    }
}

internal sealed record DesktopPaths(
    string DataRoot,
    string DatabasePath,
    string BackupDirectory,
    string LogDirectory,
    string BrowserProfileDirectory,
    string ServerExecutable,
    string AppUrl)
{
    private const int DesktopPort = 17831;

    public static DesktopPaths Create(string[] args)
    {
        var configuredRoot = ReadOption(args, "--data-root")
            ?? Environment.GetEnvironmentVariable("AXIS_DATA_ROOT");
        var dataRoot = Path.GetFullPath(string.IsNullOrWhiteSpace(configuredRoot)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Axis")
            : configuredRoot);
        var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        var backupDirectory = ReadOption(args, "--backup-directory")
            ?? Path.Combine(documents, "Axis", "Backups");

        return new DesktopPaths(
            dataRoot,
            Path.Combine(dataRoot, "Data", "axis.db"),
            Path.GetFullPath(backupDirectory),
            Path.Combine(dataRoot, "Logs"),
            Path.Combine(dataRoot, "Browser"),
            Path.Combine(AppContext.BaseDirectory, "server", "Axis.Api.exe"),
            $"http://127.0.0.1:{DesktopPort}");
    }

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(DatabasePath)!);
        Directory.CreateDirectory(BackupDirectory);
        Directory.CreateDirectory(LogDirectory);
        Directory.CreateDirectory(BrowserProfileDirectory);
    }

    private static string? ReadOption(string[] args, string name)
    {
        var index = Array.FindIndex(args, item => string.Equals(item, name, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }
}

internal sealed class BackendProcess : IDisposable
{
    private readonly Process process;
    private readonly StreamWriter standardOutput;
    private readonly StreamWriter standardError;
    private readonly string healthUrl;
    private bool disposed;

    private BackendProcess(Process process, StreamWriter standardOutput, StreamWriter standardError, string healthUrl)
    {
        this.process = process;
        this.standardOutput = standardOutput;
        this.standardError = standardError;
        this.healthUrl = healthUrl;
    }

    public bool HasExited => process.HasExited;

    public static BackendProcess Start(DesktopPaths paths)
    {
        if (!File.Exists(paths.ServerExecutable))
        {
            throw new FileNotFoundException("The bundled Axis server is missing.", paths.ServerExecutable);
        }

        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        var output = CreateLogWriter(Path.Combine(paths.LogDirectory, $"axis-{stamp}.log"));
        var errors = CreateLogWriter(Path.Combine(paths.LogDirectory, $"axis-{stamp}.error.log"));
        var startInfo = new ProcessStartInfo
        {
            FileName = paths.ServerExecutable,
            WorkingDirectory = Path.GetDirectoryName(paths.ServerExecutable)!,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("--urls");
        startInfo.ArgumentList.Add(paths.AppUrl);
        startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
        startInfo.Environment["Storage__DatabasePath"] = paths.DatabasePath;
        startInfo.Environment["Backup__Directory"] = paths.BackupDirectory;
        startInfo.Environment["SeedData"] = "false";

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, eventArgs) => WriteLog(output, eventArgs.Data);
        process.ErrorDataReceived += (_, eventArgs) => WriteLog(errors, eventArgs.Data);

        if (!process.Start())
        {
            output.Dispose();
            errors.Dispose();
            throw new InvalidOperationException("The bundled Axis server could not be started.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return new BackendProcess(process, output, errors, $"{paths.AppUrl}/api/health");
    }

    public async Task WaitUntilReadyAsync(TimeSpan timeout)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var startedAt = Stopwatch.StartNew();

        while (startedAt.Elapsed < timeout)
        {
            if (process.HasExited)
            {
                throw new InvalidOperationException($"The Axis server exited with code {process.ExitCode}.");
            }

            try
            {
                using var response = await client.GetAsync(healthUrl);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException)
            {
            }

            await Task.Delay(250);
        }

        throw new TimeoutException("The Axis server did not become ready in time.");
    }

    public void Dispose()
    {
        if (disposed)
        {
            return;
        }

        disposed = true;
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                process.WaitForExit(5000);
            }
        }
        catch (InvalidOperationException)
        {
        }
        finally
        {
            process.Dispose();
            standardOutput.Dispose();
            standardError.Dispose();
        }
    }

    private static StreamWriter CreateLogWriter(string path)
    {
        return new StreamWriter(new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.ReadWrite), Encoding.UTF8)
        {
            AutoFlush = true
        };
    }

    private static void WriteLog(StreamWriter writer, string? message)
    {
        if (message is null)
        {
            return;
        }

        lock (writer)
        {
            writer.WriteLine(message);
        }
    }
}

internal sealed class AxisApplicationContext : ApplicationContext
{
    private readonly DesktopPaths paths;
    private readonly BackendProcess backend;
    private readonly NotifyIcon trayIcon;
    private readonly System.Windows.Forms.Timer healthTimer;

    public AxisApplicationContext(DesktopPaths paths, BackendProcess backend)
    {
        this.paths = paths;
        this.backend = backend;

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open Axis", null, (_, _) => OpenAxis());
        menu.Items.Add("Open data folder", null, (_, _) => OpenFolder(paths.DataRoot));
        menu.Items.Add("Open backups", null, (_, _) => OpenFolder(paths.BackupDirectory));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => ExitThread());

        trayIcon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
            Text = $"Axis {GetVersion()}",
            ContextMenuStrip = menu,
            Visible = true
        };
        trayIcon.DoubleClick += (_, _) => OpenAxis();

        healthTimer = new System.Windows.Forms.Timer { Interval = 2000 };
        healthTimer.Tick += (_, _) => CheckBackend();
        healthTimer.Start();
    }

    public void OpenAxis()
    {
        BrowserLauncher.Open(paths.AppUrl, paths.BrowserProfileDirectory);
    }

    protected override void ExitThreadCore()
    {
        healthTimer.Stop();
        trayIcon.Visible = false;
        backend.Dispose();
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            healthTimer.Dispose();
            trayIcon.Dispose();
        }

        base.Dispose(disposing);
    }

    private void CheckBackend()
    {
        if (!backend.HasExited)
        {
            return;
        }

        healthTimer.Stop();
        MessageBox.Show(
            $"The Axis server stopped unexpectedly. Logs are available in:\n{paths.LogDirectory}",
            "Axis stopped",
            MessageBoxButtons.OK,
            MessageBoxIcon.Error);
        ExitThread();
    }

    private static string GetVersion()
    {
        return Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "desktop";
    }

    private static void OpenFolder(string path)
    {
        Process.Start(new ProcessStartInfo { FileName = path, UseShellExecute = true });
    }
}

internal static class BrowserLauncher
{
    public static void Open(string url, string profileDirectory)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "desktop";
        var separator = url.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        var versionedUrl = $"{url}{separator}desktopVersion={Uri.EscapeDataString(version)}";
        var edgePath = FindEdge();
        if (edgePath is null)
        {
            Process.Start(new ProcessStartInfo { FileName = versionedUrl, UseShellExecute = true });
            return;
        }

        Directory.CreateDirectory(profileDirectory);
        var startInfo = new ProcessStartInfo
        {
            FileName = edgePath,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add($"--app={versionedUrl}");
        startInfo.ArgumentList.Add($"--user-data-dir={profileDirectory}");
        startInfo.ArgumentList.Add("--no-first-run");
        startInfo.ArgumentList.Add("--disable-session-crashed-bubble");
        startInfo.ArgumentList.Add("--start-maximized");
        Process.Start(startInfo);
    }

    private static string? FindEdge()
    {
        var candidates = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
        };

        return candidates.FirstOrDefault(File.Exists);
    }
}

internal static class FirstRunDataImporter
{
    private const string DatabaseEntryName = "axis.db";

    public static bool PrepareDatabase(DesktopPaths paths)
    {
        if (File.Exists(paths.DatabasePath))
        {
            return true;
        }

        var answer = MessageBox.Show(
            "No desktop database exists yet.\n\nChoose Yes to copy an existing Axis backup (.zip) or database (.db). Your source file will not be modified.\n\nChoose No to start with an empty database. You can import a backup from Safety > Backup later.",
            "Axis first start",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Information);

        if (answer == DialogResult.Cancel)
        {
            return false;
        }

        if (answer == DialogResult.No)
        {
            return true;
        }

        using var picker = new OpenFileDialog
        {
            Title = "Choose an existing Axis backup or database",
            Filter = "Axis backup or database|axis-backup-*.zip;*.db|Axis backups|axis-backup-*.zip|SQLite databases|*.db",
            CheckFileExists = true,
            Multiselect = false
        };

        if (picker.ShowDialog() != DialogResult.OK)
        {
            return false;
        }

        try
        {
            Import(picker.FileName, paths.DatabasePath);
            MessageBox.Show(
                "Your existing Axis data was copied successfully. The original file remains untouched.",
                "Axis data ready",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return true;
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                $"That file could not be imported. Nothing was written to your Axis data folder.\n\n{exception.Message}",
                "Import failed",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return false;
        }
    }

    private static void Import(string sourcePath, string destinationPath)
    {
        var temporaryPath = $"{destinationPath}.{Guid.NewGuid():N}.import";

        try
        {
            if (string.Equals(Path.GetExtension(sourcePath), ".zip", StringComparison.OrdinalIgnoreCase))
            {
                ExtractBackup(sourcePath, temporaryPath);
            }
            else
            {
                File.Copy(sourcePath, temporaryPath, overwrite: false);
            }

            ValidateSqliteHeader(temporaryPath);
            File.Move(temporaryPath, destinationPath, overwrite: false);

            if (string.Equals(Path.GetExtension(sourcePath), ".db", StringComparison.OrdinalIgnoreCase))
            {
                CopySidecarIfPresent(sourcePath, destinationPath, "-wal");
                CopySidecarIfPresent(sourcePath, destinationPath, "-shm");
            }
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    private static void ExtractBackup(string sourcePath, string destinationPath)
    {
        using var archive = ZipFile.OpenRead(sourcePath);
        var manifestEntry = archive.GetEntry("manifest.json")
            ?? throw new InvalidDataException("The backup manifest is missing.");
        using (var manifestStream = manifestEntry.Open())
        using (var manifest = JsonDocument.Parse(manifestStream))
        {
            var root = manifest.RootElement;
            var appName = root.TryGetProperty("AppName", out var pascalName)
                ? pascalName.GetString()
                : root.GetProperty("appName").GetString();
            var schemaVersion = root.TryGetProperty("SchemaVersion", out var pascalSchema)
                ? pascalSchema.GetInt32()
                : root.GetProperty("schemaVersion").GetInt32();

            if (!string.Equals(appName, "Axis", StringComparison.Ordinal) || schemaVersion != 1)
            {
                throw new InvalidDataException("This backup is not compatible with Axis.");
            }
        }

        var databaseEntry = archive.GetEntry(DatabaseEntryName)
            ?? throw new InvalidDataException("The backup database is missing.");
        databaseEntry.ExtractToFile(destinationPath, overwrite: false);
    }

    private static void ValidateSqliteHeader(string path)
    {
        ReadOnlySpan<byte> expected = "SQLite format 3\0"u8;
        Span<byte> actual = stackalloc byte[expected.Length];
        using var stream = File.OpenRead(path);
        if (stream.Read(actual) != actual.Length || !actual.SequenceEqual(expected))
        {
            throw new InvalidDataException("The selected file is not a valid SQLite database.");
        }
    }

    private static void CopySidecarIfPresent(string sourcePath, string destinationPath, string suffix)
    {
        var source = $"{sourcePath}{suffix}";
        if (File.Exists(source))
        {
            File.Copy(source, $"{destinationPath}{suffix}", overwrite: false);
        }
    }
}
