using System.IO.Compression;
using System.Text.Json;
using Axis.Application.Backup;
using Microsoft.Data.Sqlite;
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

        var tempDatabasePath = Path.Combine(Path.GetTempPath(), $"axis-export-{Guid.NewGuid():N}.db");

        try
        {
            BackupDatabaseToFile(tempDatabasePath);

            await using var fileStream = File.Create(fullPath);
            using var archive = new ZipArchive(fileStream, ZipArchiveMode.Create);

            archive.CreateEntryFromFile(tempDatabasePath, DatabaseEntryName, CompressionLevel.Optimal);
            var manifestEntry = archive.CreateEntry(ManifestEntryName, CompressionLevel.Optimal);
            await using var manifestStream = manifestEntry.Open();
            await JsonSerializer.SerializeAsync(manifestStream, manifest, cancellationToken: cancellationToken);
        }
        finally
        {
            if (File.Exists(tempDatabasePath))
            {
                File.Delete(tempDatabasePath);
            }
        }

        return new BackupExportResult(fileName, fullPath, exportedAt);
    }

    public async Task<BackupValidationResult> ValidateAsync(Stream backupStream, CancellationToken cancellationToken = default)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"axis-backup-validate-{Guid.NewGuid():N}.zip");

        try
        {
            await using (var tempFile = File.Create(tempPath))
            {
                await backupStream.CopyToAsync(tempFile, cancellationToken);
            }

            await using var readStream = File.OpenRead(tempPath);
            using var archive = new ZipArchive(readStream, ZipArchiveMode.Read);
            var manifest = await ReadManifestAsync(archive, cancellationToken);

            if (manifest is null)
            {
                return new BackupValidationResult(false, "Backup manifest is missing or invalid.");
            }

            if (manifest.AppName != "Axis")
            {
                return new BackupValidationResult(false, "Backup is not an Axis backup.", manifest);
            }

            if (manifest.SchemaVersion != 1)
            {
                return new BackupValidationResult(false, "Backup schema version is not compatible.", manifest);
            }

            if (archive.GetEntry(DatabaseEntryName) is null)
            {
                return new BackupValidationResult(false, "Backup database file is missing.", manifest);
            }

            return new BackupValidationResult(true, "Backup is valid.", manifest);
        }
        catch (InvalidDataException)
        {
            return new BackupValidationResult(false, "Backup file is not a valid zip archive.");
        }
        catch (JsonException)
        {
            return new BackupValidationResult(false, "Backup manifest is not valid JSON.");
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    public async Task<BackupImportResult> ImportAsync(Stream backupStream, CancellationToken cancellationToken = default)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), $"axis-backup-import-{Guid.NewGuid():N}.zip");

        try
        {
            await using (var tempFile = File.Create(tempPath))
            {
                await backupStream.CopyToAsync(tempFile, cancellationToken);
            }

            await using (var validationStream = File.OpenRead(tempPath))
            {
                var validation = await ValidateAsync(validationStream, cancellationToken);
                if (!validation.IsValid)
                {
                    return new BackupImportResult(false, validation.Message, null, validation);
                }
            }

            var preImportBackup = File.Exists(GetDatabasePath())
                ? await ExportAsync(cancellationToken)
                : null;

            await using (var restoreStream = File.OpenRead(tempPath))
            {
                await RestoreAsync(restoreStream, replaceExisting: true, cancellationToken);
            }

            return new BackupImportResult(
                true,
                "Backup imported successfully.",
                preImportBackup?.FileName,
                new BackupValidationResult(true, "Backup is valid."));
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
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

        RestoreDatabaseFromFile(restoreTempPath);

        if (File.Exists(restoreTempPath))
        {
            File.Delete(restoreTempPath);
        }
    }

    private static async Task<BackupManifest?> ReadManifestAsync(ZipArchive archive, CancellationToken cancellationToken)
    {
        var manifestEntry = archive.GetEntry(ManifestEntryName);
        if (manifestEntry is null)
        {
            return null;
        }

        await using var stream = manifestEntry.Open();
        return await JsonSerializer.DeserializeAsync<BackupManifest>(stream, cancellationToken: cancellationToken);
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

    private void BackupDatabaseToFile(string destinationPath)
    {
        using var sourceConnection = new SqliteConnection(CreateSqliteConnectionString(GetDatabasePath()));
        using var destinationConnection = new SqliteConnection(CreateSqliteConnectionString(destinationPath));
        sourceConnection.Open();
        destinationConnection.Open();
        sourceConnection.BackupDatabase(destinationConnection);
    }

    private void RestoreDatabaseFromFile(string sourcePath)
    {
        using var sourceConnection = new SqliteConnection(CreateSqliteConnectionString(sourcePath));
        using var destinationConnection = new SqliteConnection(CreateSqliteConnectionString(GetDatabasePath()));
        sourceConnection.Open();
        destinationConnection.Open();
        sourceConnection.BackupDatabase(destinationConnection);
    }

    private static string CreateSqliteConnectionString(string databasePath)
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Pooling = false
        };

        return builder.ToString();
    }
}
