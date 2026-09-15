# Axis

Axis is a local-first personal goal, calendar, metrics, and progress tracking app for realistic planning without guilt.

## Stack

- Backend: .NET 10, ASP.NET Core Minimal APIs, EF Core, SQLite
- Frontend: React, TypeScript, Vite
- Local runtime: Docker Compose
- Launcher: .NET console app, matching the Repetitio launcher style

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

## Local Data

- SQLite database: `data/axis.db`
- Backups: `backups/`

The app seeds starter life areas and activity templates on first startup.
