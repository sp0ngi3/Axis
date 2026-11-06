using System.IO.Compression;
using System.Text.RegularExpressions;
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
        var exportedAt = DateTimeOffset.UtcNow;
        var fileName = $"axis-backup-{exportedAt:yyyyMMdd-HHmmss}.zip";
        return await CreateBackupArchiveAsync(fileName, GetAppVersion(), exportedAt, cancellationToken);
    }

    public async Task<BackupExportResult?> CreatePreUpgradeBackupAsync(string appVersion, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(GetDatabasePath()))
        {
            return null;
        }

        var safeVersion = Regex.Replace(appVersion, "[^A-Za-z0-9._-]", "-");
        var fileName = $"axis-safety-before-{safeVersion}.zip";
        var fullPath = Path.Combine(GetBackupDirectory(), fileName);
        if (File.Exists(fullPath))
        {
            await using var existingBackup = File.OpenRead(fullPath);
            var validation = await ValidateAsync(existingBackup, cancellationToken);
            if (validation.IsValid)
            {
                return new BackupExportResult(fileName, fullPath, File.GetLastWriteTimeUtc(fullPath));
            }
        }

        var result = await CreateBackupArchiveAsync(fileName, appVersion, DateTimeOffset.UtcNow, cancellationToken);
        PrunePreUpgradeBackups(keepCount: 5);
        return result;
    }

    private async Task<BackupExportResult> CreateBackupArchiveAsync(
        string fileName,
        string appVersion,
        DateTimeOffset exportedAt,
        CancellationToken cancellationToken)
    {
        var databasePath = GetDatabasePath();
        var backupDirectory = GetBackupDirectory();
        Directory.CreateDirectory(backupDirectory);

        if (!File.Exists(databasePath))
        {
            throw new FileNotFoundException("Axis database does not exist yet.", databasePath);
        }

        var fullPath = Path.Combine(backupDirectory, fileName);
        var temporaryArchivePath = $"{fullPath}.{Guid.NewGuid():N}.tmp";
        var manifest = new BackupManifest("Axis", appVersion, 1, exportedAt, DatabaseEntryName);

        var tempDatabasePath = Path.Combine(Path.GetTempPath(), $"axis-export-{Guid.NewGuid():N}.db");
        var archiveMoved = false;

        try
        {
            BackupDatabaseToFile(tempDatabasePath);

            await using (var fileStream = File.Create(temporaryArchivePath))
            using (var archive = new ZipArchive(fileStream, ZipArchiveMode.Create))
            {
                archive.CreateEntryFromFile(tempDatabasePath, DatabaseEntryName, CompressionLevel.Optimal);
                var manifestEntry = archive.CreateEntry(ManifestEntryName, CompressionLevel.Optimal);
                await using var manifestStream = manifestEntry.Open();
                await JsonSerializer.SerializeAsync(manifestStream, manifest, cancellationToken: cancellationToken);
            }

            await using (var archiveStream = File.OpenRead(temporaryArchivePath))
            {
                var validation = await ValidateAsync(archiveStream, cancellationToken);
                if (!validation.IsValid)
                {
                    throw new InvalidDataException($"Axis did not replace or modify the database because the new safety backup could not be validated: {validation.Message}");
                }
            }

            File.Move(temporaryArchivePath, fullPath, overwrite: true);
            archiveMoved = true;
            return new BackupExportResult(fileName, fullPath, exportedAt);
        }
        finally
        {
            if (File.Exists(tempDatabasePath))
            {
                File.Delete(tempDatabasePath);
            }

            if (!archiveMoved && File.Exists(temporaryArchivePath))
            {
                File.Delete(temporaryArchivePath);
            }
        }
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

            var databaseEntry = archive.GetEntry(DatabaseEntryName);
            if (databaseEntry is null)
            {
                return new BackupValidationResult(false, "Backup database file is missing.", manifest);
            }

            var databaseValidation = await ValidateDatabaseEntryAsync(databaseEntry, cancellationToken);
            if (databaseValidation is not null)
            {
                return new BackupValidationResult(false, databaseValidation, manifest);
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
        catch (SqliteException)
        {
            return new BackupValidationResult(false, "The SQLite database inside this backup is damaged or unreadable.");
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
            throw new InvalidOperationException("Restore was not started because Axis is already using a database. Your existing data was left unchanged. Use Safety > Backup to validate and import the backup safely.");
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

        var restoreTempPath = $"{databasePath}.{Guid.NewGuid():N}.restore";
        try
        {
            await using (var entryStream = databaseEntry.Open())
            await using (var restoreStream = File.Create(restoreTempPath))
            {
                await entryStream.CopyToAsync(restoreStream, cancellationToken);
            }

            var validationMessage = await ValidateDatabaseFileAsync(restoreTempPath, cancellationToken);
            if (validationMessage is not null)
            {
                throw new InvalidDataException(validationMessage);
            }

            RestoreDatabaseFromFile(restoreTempPath);
        }
        finally
        {
            if (File.Exists(restoreTempPath))
            {
                File.Delete(restoreTempPath);
            }
        }
    }

    private static async Task<string?> ValidateDatabaseEntryAsync(ZipArchiveEntry databaseEntry, CancellationToken cancellationToken)
    {
        var path = Path.Combine(Path.GetTempPath(), $"axis-backup-database-{Guid.NewGuid():N}.db");
        try
        {
            await using (var source = databaseEntry.Open())
            await using (var destination = File.Create(path))
            {
                await source.CopyToAsync(destination, cancellationToken);
            }

            return await ValidateDatabaseFileAsync(path, cancellationToken);
        }
        finally
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }

    private static async Task<string?> ValidateDatabaseFileAsync(string path, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(CreateSqliteConnectionString(path));
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA quick_check;";
        var result = (await command.ExecuteScalarAsync(cancellationToken))?.ToString();
        return string.Equals(result, "ok", StringComparison.OrdinalIgnoreCase)
            ? null
            : $"The SQLite database inside this backup failed its integrity check: {result ?? "unknown error"}.";
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
        var configuredPath = configuration["Storage:DatabasePath"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.GetFullPath(configuredPath);
        }

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

    private string GetAppVersion()
    {
        return configuration["App:Version"]
            ?? typeof(AxisBackupService).Assembly.GetName().Version?.ToString(3)
            ?? "unknown";
    }

    private void PrunePreUpgradeBackups(int keepCount)
    {
        foreach (var path in Directory.EnumerateFiles(GetBackupDirectory(), "axis-safety-before-*.zip")
                     .OrderByDescending(File.GetLastWriteTimeUtc)
                     .Skip(keepCount))
        {
            File.Delete(path);
        }
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
