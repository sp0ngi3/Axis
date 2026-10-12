# Axis for Windows

Axis has two independent local runtimes. The Docker Compose runtime remains available, while the desktop runtime packages the same React frontend and ASP.NET Core API into an offline Windows build.

## Install

1. Build a release with `powershell -ExecutionPolicy Bypass -File .\tools\publish-desktop.ps1 -Version 0.2.0`.
2. Run `artifacts\desktop\Axis-Setup-0.2.0.exe`.
3. Start Axis from the desktop or Start menu shortcut.
4. On the first start, choose an existing `axis-backup-*.zip` or `axis.db`, or start with an empty database.

The setup is per-user and does not need administrator access. It installs application binaries to `%LOCALAPPDATA%\Programs\Axis`.

## Data safety

- Desktop database: `%LOCALAPPDATA%\Axis\Data\axis.db`
- Desktop backups: `%USERPROFILE%\Documents\Axis\Backups`
- Logs: `%LOCALAPPDATA%\Axis\Logs`
- Browser profile: `%LOCALAPPDATA%\Axis\Browser`

Application updates replace only `%LOCALAPPDATA%\Programs\Axis`. They do not overwrite the database, backups, logs, or browser profile. Uninstall also preserves the database and backups.

The first-start importer accepts the existing schema-version-1 Axis backup format and raw SQLite databases. It copies the selected source and never moves or changes it. Importing through `Safety > Backup` continues to create a pre-import backup before replacing a populated database.

Do not run Docker Axis and desktop Axis against the same raw database file at the same time. The recommended transfer path is an Axis backup ZIP.

## Daily use

Double-click `Axis`. The local API starts in the background and the existing UI opens as an Edge application window. Axis remains available from the notification area:

- `Open Axis`
- `Open data folder`
- `Open backups`
- `Quit`

Closing the window leaves Axis available in the tray. Use `Quit` to stop the local API.

No package restore, Docker build, Node.js installation, or internet connection is needed to run an already built desktop release.

## Portable build

Extract `artifacts\desktop\Axis-0.2.0-win-x64-portable.zip` and run `Axis.exe`. Portable and installed builds intentionally use the same `%LOCALAPPDATA%\Axis` data directory, so moving between them does not fork the database.

## Updates

1. Change the version passed to `publish-desktop.ps1`.
2. Build and test the new release.
3. Run the new setup executable over the existing installation.

The setup uses a stable installation directory and Windows uninstall registration. Existing desktop data remains outside the installation directory.

For a machine whose dependencies are already restored, `publish-desktop.ps1 -Offline` avoids NuGet restore and refuses to install missing frontend packages. This is useful during a registry outage. Keep the last known-good setup executable: it stays runnable regardless of NuGet availability.

## Docker mode

Docker remains unchanged:

```powershell
docker compose up -d --build
```

The existing `00-AXIS.exe` Docker launcher remains available as well.
