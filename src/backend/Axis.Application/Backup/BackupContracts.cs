namespace Axis.Application.Backup;

public sealed record BackupManifest(
    string AppName,
    string AppVersion,
    int SchemaVersion,
    DateTimeOffset ExportedAt,
    string DatabaseFileName);

public sealed record BackupExportResult(string FileName, string FullPath, DateTimeOffset ExportedAt);

public sealed record BackupStatus(bool DatabaseExists, string DatabasePath, string BackupDirectory, IReadOnlyList<string> RecentBackups);

public interface IAxisBackupService
{
    Task<BackupStatus> GetStatusAsync(CancellationToken cancellationToken = default);

    Task<BackupExportResult> ExportAsync(CancellationToken cancellationToken = default);

    Task RestoreAsync(Stream backupStream, bool replaceExisting, CancellationToken cancellationToken = default);
}
