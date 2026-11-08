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

To rebuild the current source and update the installed Windows application, double-click:

```text
AKTUALIZUJ-AXIS.cmd
```

The updater runs the tests, builds and verifies the installer, and then opens its Install screen. It updates application files only; the database and backups remain outside the installation directory. By default it uses restored local dependencies. Run `AKTUALIZUJ-AXIS.cmd -Online` only when a new dependency must be downloaded.

Build the versioned installer and portable release:

```powershell
.\tools\publish-desktop.ps1 -Version 0.4.3
```

Generated artifacts:

- `artifacts\desktop\Axis-Setup-0.4.3.exe`
- `artifacts\desktop\Axis-0.4.2-win-x64-portable.zip`

The installed application uses the same React UI and API without Docker. It runs in an Edge application window, keeps the server in the Windows notification area, and requires no package download at runtime. See [Windows desktop documentation](docs/windows-desktop.md) for data locations, first-run import, offline builds, and update instructions.

## Phone and tablet app (PWA)

Axis can be installed from a browser as a Progressive Web App. Use the `Install Axis` control at the bottom of the navigation panel:

- Android, Windows, and supported tablets: open Axis in Chrome or Edge and choose `Install app` or `Add to Home screen`.
- iPhone and iPad: open Axis in Safari, tap `Share`, then `Add to Home Screen`.

Mobile installation requires an HTTPS address (browsers allow plain HTTP only for `localhost`). When opening Axis from another device, use the secure network address of the computer hosting Axis rather than `localhost`. That computer and the Axis API must remain running while records are read or changed.

The PWA caches only the application shell. `/api` requests, records, backups, and the SQLite database are explicitly excluded from browser caches. Installing or removing the home-screen app therefore cannot replace or delete the existing database.

## Local Data

- SQLite database: `data/axis.db`
- Backups: `backups/`

Starter data is opt-in. Current Docker and desktop configurations keep `SeedData` disabled.

Docker creates one validated automatic backup every day at 03:00 in the `Europe/Berlin` time zone. If the container starts after 03:00 and today's snapshot is missing, it creates the snapshot immediately. Files use the `axis-daily-YYYYMMDD.zip` name and only the three newest daily snapshots are retained. Manual `axis-backup-*` exports and `axis-safety-before-*` upgrade backups are separate and are never removed by the daily rotation.

The running version and runtime are always visible next to the Axis logo. Before a desktop release initializes an existing database for the first time, it creates a validated safety backup in `%USERPROFILE%\Documents\Axis\Backups`. Docker waits for the API health check before starting the frontend.

For the code layout and compatibility rules, see [Architecture](docs/ARCHITECTURE.md).

For the private VPS deployment behind Cloudflare Access at `life.kamilstudzinski.dev`, see [Hosted deployment](docs/hosted-deployment.md).
