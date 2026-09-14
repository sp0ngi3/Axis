using System.Diagnostics;

namespace Axis.Launcher;

internal static class Program
{
    private const string FrontendUrl = "http://localhost:3001";

    public static async Task<int> Main(string[] args)
    {
        var workspace = FindWorkspaceRoot(AppContext.BaseDirectory);
        var isInteractive = args.Length == 0;

        if (workspace is null)
        {
            Console.Error.WriteLine("Could not find docker-compose.yml for Axis.");
            PauseIfInteractive(isInteractive);
            return 1;
        }

        var command = isInteractive ? ReadInteractiveCommand() : args.First().Trim().ToLowerInvariant();
        var exitCode = command switch
        {
            "run" => await RunUntilEnterAsync(workspace),
            "start" => await StartAsync(workspace),
            "stop" => await StopAsync(workspace),
            "restart" => await RestartAsync(workspace),
            "status" => await StatusAsync(workspace),
            "exit" => 0,
            _ => WriteUsage()
        };

        PauseIfInteractive(isInteractive && command is not "run" and not "exit");
        return exitCode;
    }

    private static async Task<int> RunUntilEnterAsync(string workspace)
    {
        var exitCode = await StartAsync(workspace);

        if (exitCode != 0)
        {
            Console.WriteLine("Startup failed. Press Enter to close this window.");
            Console.ReadLine();
            return exitCode;
        }

        Console.WriteLine();
        Console.WriteLine("Axis is running.");
        Console.WriteLine($"Frontend: {FrontendUrl}");
        Console.WriteLine("API:      http://localhost:8081");
        Console.WriteLine();
        Console.WriteLine("Press Enter to stop Axis.");
        Console.ReadLine();

        return await StopAsync(workspace);
    }

    private static async Task<int> StartAsync(string workspace)
    {
        var exitCode = await RunDockerComposeAsync(workspace, "up", "-d", "--build");

        if (exitCode == 0)
        {
            OpenFrontend();
        }

        return exitCode;
    }

    private static Task<int> StopAsync(string workspace)
    {
        return RunDockerComposeAsync(workspace, "down");
    }

    private static async Task<int> RestartAsync(string workspace)
    {
        var stopExitCode = await StopAsync(workspace);
        return stopExitCode == 0 ? await StartAsync(workspace) : stopExitCode;
    }

    private static Task<int> StatusAsync(string workspace)
    {
        return RunDockerComposeAsync(workspace, "ps");
    }

    private static async Task<int> RunDockerComposeAsync(string workspace, params string[] arguments)
    {
        using var process = new Process();
        process.StartInfo.FileName = "docker";
        process.StartInfo.WorkingDirectory = workspace;
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.RedirectStandardOutput = true;
        process.StartInfo.RedirectStandardError = true;
        process.StartInfo.ArgumentList.Add("compose");

        foreach (var argument in arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        process.OutputDataReceived += (_, eventArgs) => WriteLine(eventArgs.Data, Console.Out);
        process.ErrorDataReceived += (_, eventArgs) => WriteLine(eventArgs.Data, Console.Error);

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync();

        return process.ExitCode;
    }

    private static void OpenFrontend()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = FrontendUrl,
                UseShellExecute = true
            });
        }
        catch (InvalidOperationException)
        {
            Console.WriteLine($"Open {FrontendUrl} manually.");
        }
        catch (System.ComponentModel.Win32Exception)
        {
            Console.WriteLine($"Open {FrontendUrl} manually.");
        }
    }

    private static string ReadInteractiveCommand()
    {
        Console.WriteLine("Axis");
        Console.WriteLine("1. Run until Enter, then stop");
        Console.WriteLine("2. Start and keep running");
        Console.WriteLine("3. Stop");
        Console.WriteLine("4. Restart");
        Console.WriteLine("5. Status");
        Console.WriteLine("0. Exit");
        Console.Write("Choose: ");

        return Console.ReadLine()?.Trim() switch
        {
            "1" => "run",
            "2" => "start",
            "3" => "stop",
            "4" => "restart",
            "5" => "status",
            "0" => "exit",
            var value => value ?? "exit"
        };
    }

    private static string? FindWorkspaceRoot(string startDirectory)
    {
        var directory = new DirectoryInfo(startDirectory);

        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "docker-compose.yml")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        var currentDirectory = Directory.GetCurrentDirectory();
        return File.Exists(Path.Combine(currentDirectory, "docker-compose.yml")) ? currentDirectory : null;
    }

    private static int WriteUsage()
    {
        Console.WriteLine("Usage: 00-AXIS.exe [run|start|stop|restart|status]");
        return 1;
    }

    private static void PauseIfInteractive(bool shouldPause)
    {
        if (!shouldPause)
        {
            return;
        }

        Console.WriteLine();
        Console.WriteLine("Press Enter to close this window.");
        Console.ReadLine();
    }

    private static void WriteLine(string? line, TextWriter writer)
    {
        if (!string.IsNullOrWhiteSpace(line))
        {
            writer.WriteLine(line);
        }
    }
}
