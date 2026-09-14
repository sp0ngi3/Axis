using System.IO.Compression;
using System.Text.Json;
using Axis.Application.Backup;
using Microsoft.Extensions.Configuration;

namespace Axis.Infrastructure.Backup;

public sealed class AxisBackupService(IConfiguration configuration) : IAxisBackupService
{
    private const string DatabaseEntryName = "axis.db";
    private const string ManifestEntryName = "manifest.json";

    public Task<BackupStatus> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var databasePath = GetDatabasePath();
        var backupDirectory = GetBackupDirectory();
        Directory.CreateDirectory(backupDirectory);

        var recentBackups = Directory
            .EnumerateFiles(backupDirectory, "axis-backup-*.zip")
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .Take(5)
            .Select(Path.GetFileName)
            .OfType<string>()
            .ToList();

        return Task.FromResult(new BackupStatus(File.Exists(databasePath), databasePath, backupDirectory, recentBackups));
    }

    public async Task<BackupExportResult> ExportAsync(CancellationToken cancellationToken = default)
    {
        var databasePath = GetDatabasePath();
        var backupDirectory = GetBackupDirectory();
        Directory.CreateDirectory(backupDirectory);

        if (!File.Exists(databasePath))
        {
            throw new FileNotFoundException("Axis database does not exist yet.", databasePath);
        }

        var exportedAt = DateTimeOffset.UtcNow;
        var fileName = $"axis-backup-{exportedAt:yyyyMMdd-HHmmss}.zip";
        var fullPath = Path.Combine(backupDirectory, fileName);
        var manifest = new BackupManifest("Axis", "0.1.0", 1, exportedAt, DatabaseEntryName);

        await using var fileStream = File.Create(fullPath);
        using var archive = new ZipArchive(fileStream, ZipArchiveMode.Create);

        archive.CreateEntryFromFile(databasePath, DatabaseEntryName, CompressionLevel.Optimal);
        var manifestEntry = archive.CreateEntry(ManifestEntryName, CompressionLevel.Optimal);
        await using var manifestStream = manifestEntry.Open();
        await JsonSerializer.SerializeAsync(manifestStream, manifest, cancellationToken: cancellationToken);

        return new BackupExportResult(fileName, fullPath, exportedAt);
    }

    public async Task RestoreAsync(Stream backupStream, bool replaceExisting, CancellationToken cancellationToken = default)
    {
        var databasePath = GetDatabasePath();
        var databaseDirectory = Path.GetDirectoryName(databasePath);

        if (databaseDirectory is not null)
        {
            Directory.CreateDirectory(databaseDirectory);
        }

        if (File.Exists(databasePath) && !replaceExisting)
        {
            throw new InvalidOperationException("Database already exists. Set replaceExisting to true to restore over it.");
        }

        using var archive = new ZipArchive(backupStream, ZipArchiveMode.Read, leaveOpen: true);
        var manifestEntry = archive.GetEntry(ManifestEntryName) ?? throw new InvalidOperationException("Backup manifest is missing.");
        var databaseEntry = archive.GetEntry(DatabaseEntryName) ?? throw new InvalidOperationException("Backup database is missing.");

        await using var manifestStream = manifestEntry.Open();
        var manifest = await JsonSerializer.DeserializeAsync<BackupManifest>(manifestStream, cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Backup manifest is invalid.");

        if (manifest.AppName != "Axis" || manifest.SchemaVersion != 1)
        {
            throw new InvalidOperationException("Backup is not compatible with this Axis version.");
        }

        var restoreTempPath = $"{databasePath}.restore";
        await using (var entryStream = databaseEntry.Open())
        await using (var restoreStream = File.Create(restoreTempPath))
        {
            await entryStream.CopyToAsync(restoreStream, cancellationToken);
        }

        File.Move(restoreTempPath, databasePath, overwrite: true);
    }

    private string GetDatabasePath()
    {
        var connectionString = configuration.GetConnectionString("Axis") ?? "Data Source=data/axis.db";
        const string marker = "Data Source=";
        var start = connectionString.IndexOf(marker, StringComparison.OrdinalIgnoreCase);

        if (start < 0)
        {
            return Path.GetFullPath("data/axis.db");
        }

        var value = connectionString[(start + marker.Length)..].Split(';', StringSplitOptions.TrimEntries)[0];
        return Path.GetFullPath(value);
    }

    private string GetBackupDirectory()
    {
        return Path.GetFullPath(configuration["Backup:Directory"] ?? "backups");
    }
}
