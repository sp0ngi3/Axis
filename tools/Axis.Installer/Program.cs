using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace Axis.Installer;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        if (args.Contains("--verify", StringComparer.OrdinalIgnoreCase))
        {
            InstallerOperations.VerifyPayload();
            return;
        }

        if (args.Contains("--uninstall", StringComparer.OrdinalIgnoreCase))
        {
            Uninstall();
            return;
        }

        Application.Run(new InstallerForm());
    }

    private static void Uninstall()
    {
        var installDirectory = InstallerPaths.InstallDirectory;
        if (InstallerOperations.IsAxisRunning(installDirectory))
        {
            MessageBox.Show("Close Axis from its tray icon before uninstalling it.", "Axis is running", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        var answer = MessageBox.Show(
            "Remove the Axis desktop application?\n\nYour database and backups will be preserved.",
            "Uninstall Axis",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (answer != DialogResult.Yes)
        {
            return;
        }

        InstallerOperations.RemoveShortcuts();
        InstallerOperations.RemoveUninstallRegistration();
        InstallerOperations.DeleteInstallationAfterExit(installDirectory);
        MessageBox.Show(
            $"Axis was uninstalled. Your data remains in:\n{InstallerPaths.DataDirectory}",
            "Axis uninstalled",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }
}

internal sealed class InstallerForm : Form
{
    private readonly Button installButton;
    private readonly ProgressBar progress;
    private readonly Label status;
    private readonly CheckBox launchAfterInstall;

    public InstallerForm()
    {
        Text = $"Install Axis {InstallerOperations.Version}";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(560, 330);
        BackColor = Color.FromArgb(18, 12, 38);
        ForeColor = Color.FromArgb(242, 238, 255);
        Font = new Font("Segoe UI", 10);

        var title = new Label
        {
            Text = "AXIS",
            Font = new Font("Segoe UI Semibold", 27, FontStyle.Bold),
            ForeColor = Color.FromArgb(99, 222, 234),
            Location = new Point(36, 28),
            AutoSize = true
        };
        var subtitle = new Label
        {
            Text = "Local-first desktop edition",
            Font = new Font("Segoe UI Semibold", 13),
            Location = new Point(38, 82),
            AutoSize = true
        };
        var description = new Label
        {
            Text = "Installs the same Axis interface without Docker. Updates replace only application files; your database and backups stay in your Windows profile.",
            Location = new Point(40, 125),
            Size = new Size(480, 54),
            ForeColor = Color.FromArgb(196, 188, 220)
        };
        status = new Label
        {
            Text = $"Install to {InstallerPaths.InstallDirectory}",
            Location = new Point(40, 188),
            Size = new Size(480, 42),
            ForeColor = Color.FromArgb(161, 153, 190)
        };
        progress = new ProgressBar
        {
            Location = new Point(40, 236),
            Size = new Size(480, 8),
            Style = ProgressBarStyle.Marquee,
            Visible = false
        };
        launchAfterInstall = new CheckBox
        {
            Text = "Launch Axis after installation",
            Location = new Point(40, 267),
            AutoSize = true,
            Checked = true
        };
        installButton = new Button
        {
            Text = "Install",
            Location = new Point(410, 264),
            Size = new Size(110, 38),
            BackColor = Color.FromArgb(113, 84, 220),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        installButton.FlatAppearance.BorderColor = Color.FromArgb(99, 222, 234);
        installButton.Click += InstallButtonClicked;

        Controls.AddRange([title, subtitle, description, status, progress, launchAfterInstall, installButton]);
    }

    private async void InstallButtonClicked(object? sender, EventArgs eventArgs)
    {
        if (InstallerOperations.IsAxisRunning(InstallerPaths.InstallDirectory))
        {
            MessageBox.Show("Close Axis from its tray icon before installing an update.", "Axis is running", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        installButton.Enabled = false;
        progress.Visible = true;
        status.Text = "Installing Axis...";

        try
        {
            await Task.Run(InstallerOperations.Install);
            status.Text = "Axis is installed.";
            progress.Visible = false;
            MessageBox.Show(
                "Axis was installed successfully. Existing desktop data, Docker data, and backup files were not modified.",
                "Axis ready",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);

            if (launchAfterInstall.Checked)
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = InstallerPaths.AxisExecutable,
                    WorkingDirectory = InstallerPaths.InstallDirectory,
                    UseShellExecute = true
                });
            }

            Close();
        }
        catch (Exception exception)
        {
            progress.Visible = false;
            status.Text = "Installation failed. No user data was changed.";
            installButton.Enabled = true;
            MessageBox.Show(exception.Message, "Installation failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}

internal static class InstallerPaths
{
    public static string InstallDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Programs",
        "Axis");

    public static string AxisExecutable { get; } = Path.Combine(InstallDirectory, "Axis.exe");
    public static string DataDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Axis");
    public static string DesktopShortcut { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
        "Axis.lnk");
    public static string StartMenuShortcut { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
        "Programs",
        "Axis.lnk");
}

internal static class InstallerOperations
{
    private const string PayloadName = "Axis.Desktop.Payload.zip";
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Axis";
    private const int MoveFileDelayUntilReboot = 0x4;

    public static string Version { get; } = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "desktop";

    public static void Install()
    {
        var installDirectory = InstallerPaths.InstallDirectory;
        var parentDirectory = Path.GetDirectoryName(installDirectory)!;
        var stagingDirectory = Path.Combine(parentDirectory, $"Axis.staging.{Guid.NewGuid():N}");
        var previousDirectory = Path.Combine(parentDirectory, $"Axis.previous.{Guid.NewGuid():N}");
        Directory.CreateDirectory(parentDirectory);

        try
        {
            ExtractPayload(stagingDirectory);
            if (!File.Exists(Path.Combine(stagingDirectory, "Axis.exe"))
                || !File.Exists(Path.Combine(stagingDirectory, "server", "Axis.Api.exe")))
            {
                throw new InvalidDataException("The installer payload is incomplete.");
            }

            if (Directory.Exists(installDirectory))
            {
                Directory.Move(installDirectory, previousDirectory);
            }

            Directory.Move(stagingDirectory, installDirectory);
            File.Copy(Environment.ProcessPath!, Path.Combine(installDirectory, "Axis-Uninstall.exe"), overwrite: true);
            ShortcutWriter.Create(InstallerPaths.DesktopShortcut, InstallerPaths.AxisExecutable, installDirectory);
            ShortcutWriter.Create(InstallerPaths.StartMenuShortcut, InstallerPaths.AxisExecutable, installDirectory);
            RegisterUninstaller();

            if (Directory.Exists(previousDirectory))
            {
                try
                {
                    Directory.Delete(previousDirectory, recursive: true);
                }
                catch (IOException)
                {
                    // A locked old binary should not turn a successful update into a failed install.
                }
                catch (UnauthorizedAccessException)
                {
                }
            }
        }
        catch
        {
            if (Directory.Exists(previousDirectory))
            {
                if (Directory.Exists(installDirectory))
                {
                    Directory.Delete(installDirectory, recursive: true);
                }

                Directory.Move(previousDirectory, installDirectory);
            }

            throw;
        }
        finally
        {
            if (Directory.Exists(stagingDirectory))
            {
                Directory.Delete(stagingDirectory, recursive: true);
            }
        }
    }

    public static void VerifyPayload()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"axis-installer-verify-{Guid.NewGuid():N}");
        try
        {
            ExtractPayload(directory);
            if (!File.Exists(Path.Combine(directory, "Axis.exe"))
                || !File.Exists(Path.Combine(directory, "server", "Axis.Api.exe"))
                || !File.Exists(Path.Combine(directory, "server", "wwwroot", "index.html")))
            {
                throw new InvalidDataException("The installer payload is incomplete.");
            }
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    public static bool IsAxisRunning(string installDirectory)
    {
        foreach (var process in Process.GetProcessesByName("Axis"))
        {
            try
            {
                var path = process.MainModule?.FileName;
                if (path is not null && path.StartsWith(installDirectory, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            catch (InvalidOperationException)
            {
            }
            catch (System.ComponentModel.Win32Exception)
            {
            }
            finally
            {
                process.Dispose();
            }
        }

        return false;
    }

    public static void RemoveShortcuts()
    {
        DeleteIfExists(InstallerPaths.DesktopShortcut);
        DeleteIfExists(InstallerPaths.StartMenuShortcut);
    }

    public static void RemoveUninstallRegistration()
    {
        Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, throwOnMissingSubKey: false);
    }

    public static void DeleteInstallationAfterExit(string installDirectory)
    {
        if (!Directory.Exists(installDirectory))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(installDirectory, "*", SearchOption.AllDirectories))
        {
            try
            {
                File.Delete(file);
            }
            catch (IOException)
            {
                MoveFileEx(file, null, MoveFileDelayUntilReboot);
            }
            catch (UnauthorizedAccessException)
            {
                MoveFileEx(file, null, MoveFileDelayUntilReboot);
            }
        }

        foreach (var directory in Directory.EnumerateDirectories(installDirectory, "*", SearchOption.AllDirectories).OrderByDescending(path => path.Length))
        {
            TryDeleteOrSchedule(directory);
        }

        TryDeleteOrSchedule(installDirectory);
    }

    private static void ExtractPayload(string stagingDirectory)
    {
        Directory.CreateDirectory(stagingDirectory);
        using var payload = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadName)
            ?? throw new InvalidOperationException("The embedded Axis payload is missing.");
        using var archive = new ZipArchive(payload, ZipArchiveMode.Read);
        var root = Path.GetFullPath(stagingDirectory) + Path.DirectorySeparatorChar;

        foreach (var entry in archive.Entries)
        {
            var destination = Path.GetFullPath(Path.Combine(stagingDirectory, entry.FullName));
            if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("The installer payload contains an unsafe path.");
            }

            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(destination);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            entry.ExtractToFile(destination, overwrite: true);
        }
    }

    private static void RegisterUninstaller()
    {
        using var key = Registry.CurrentUser.CreateSubKey(UninstallKey);
        var uninstaller = Path.Combine(InstallerPaths.InstallDirectory, "Axis-Uninstall.exe");
        key.SetValue("DisplayName", "Axis");
        key.SetValue("DisplayVersion", Version);
        key.SetValue("Publisher", "Axis");
        key.SetValue("InstallLocation", InstallerPaths.InstallDirectory);
        key.SetValue("DisplayIcon", InstallerPaths.AxisExecutable);
        key.SetValue("UninstallString", $"\"{uninstaller}\" --uninstall");
        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }

    private static void DeleteIfExists(string path)
    {
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    private static void TryDeleteOrSchedule(string path)
    {
        try
        {
            Directory.Delete(path, recursive: false);
        }
        catch (IOException)
        {
            MoveFileEx(path, null, MoveFileDelayUntilReboot);
        }
        catch (UnauthorizedAccessException)
        {
            MoveFileEx(path, null, MoveFileDelayUntilReboot);
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool MoveFileEx(string existingFileName, string? newFileName, int flags);
}

internal static class ShortcutWriter
{
    public static void Create(string shortcutPath, string targetPath, string workingDirectory)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(shortcutPath)!);
        var shellType = Type.GetTypeFromProgID("WScript.Shell")
            ?? throw new InvalidOperationException("Windows Script Host is unavailable.");
        dynamic shell = Activator.CreateInstance(shellType)!;
        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = targetPath;
        shortcut.WorkingDirectory = workingDirectory;
        shortcut.IconLocation = $"{targetPath},0";
        shortcut.Description = "Axis local-first life operating system";
        shortcut.Save();
        Marshal.FinalReleaseComObject(shortcut);
        Marshal.FinalReleaseComObject(shell);
    }
}
