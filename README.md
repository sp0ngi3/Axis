# Axis

Axis is a local-first personal goal, calendar, metrics, and progress tracking app for realistic planning without guilt.

## Stack

- Backend: .NET 10, ASP.NET Core Minimal APIs, EF Core, SQLite
- Frontend: React, TypeScript, Vite
- Local runtimes: Docker Compose and offline Windows desktop
- Launchers: Docker console launcher and native Windows tray host

## Run

```powershell
docker compose up -d --build
```

Frontend: http://localhost:3001  
API: http://localhost:8081/api/health

Or run the launcher:

```powershell
dotnet run --project tools/Axis.Launcher -- run
```

On Windows, publish the root launcher executable:

```powershell
.\tools\publish-launcher.ps1
.\00-AXIS.exe
```

Double-clicking `00-AXIS.exe` opens the same local menu style as Repetitio: Run, Start, Stop, Restart, Status, and Exit.

## Windows Desktop

Build the versioned installer and portable release:

```powershell
.\tools\publish-desktop.ps1 -Version 0.4.3
```

Generated artifacts:

- `artifacts\desktop\Axis-Setup-0.4.3.exe`
- `artifacts\desktop\Axis-0.4.2-win-x64-portable.zip`

The installed application uses the same React UI and API without Docker. It runs in an Edge application window, keeps the server in the Windows notification area, and requires no package download at runtime. See [Windows desktop documentation](docs/windows-desktop.md) for data locations, first-run import, offline builds, and update instructions.

## Local Data

- SQLite database: `data/axis.db`
- Backups: `backups/`

Starter data is opt-in. Current Docker and desktop configurations keep `SeedData` disabled.

The running version and runtime are always visible next to the Axis logo. Before a desktop release initializes an existing database for the first time, it creates a validated safety backup in `%USERPROFILE%\Documents\Axis\Backups`. Docker waits for the API health check before starting the frontend.
