namespace Axis.Application.Backup;

public sealed record BackupManifest(
    string AppName,
    string AppVersion,
    int SchemaVersion,
    DateTimeOffset ExportedAt,
    string DatabaseFileName);

public sealed record BackupExportResult(string FileName, string FullPath, DateTimeOffset ExportedAt);

public sealed record DailyBackupStatus(
    bool Enabled,
    int RetentionCount,
    string RunAtLocalTime,
    string TimeZoneId,
    string? LatestBackup);

public sealed record BackupStatus(
    bool DatabaseExists,
    string DatabasePath,
    string BackupDirectory,
    IReadOnlyList<string> RecentBackups,
    DailyBackupStatus DailyBackup);

public sealed record BackupValidationResult(bool IsValid, string Message, BackupManifest? Manifest = null);

public sealed record BackupImportResult(bool Imported, string Message, string? PreImportBackupFileName, BackupValidationResult Validation);

public interface IAxisBackupService
{
    Task<BackupStatus> GetStatusAsync(CancellationToken cancellationToken = default);

    Task<BackupExportResult> ExportAsync(CancellationToken cancellationToken = default);

    Task<BackupExportResult?> CreatePreUpgradeBackupAsync(string appVersion, CancellationToken cancellationToken = default);

    Task<BackupExportResult> CreateDailyBackupAsync(DateOnly backupDate, CancellationToken cancellationToken = default);

    Task<BackupValidationResult> ValidateAsync(Stream backupStream, CancellationToken cancellationToken = default);

    Task<BackupImportResult> ImportAsync(Stream backupStream, CancellationToken cancellationToken = default);

    Task RestoreAsync(Stream backupStream, bool replaceExisting, CancellationToken cancellationToken = default);
}
