using System.Globalization;
using Axis.Application.Backup;

public sealed class DailyBackupHostedService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<DailyBackupHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Backup:Daily:Enabled", false))
        {
            logger.LogInformation("Automatic daily backups are disabled.");
            return;
        }

        var runAt = ReadRunTime();
        var timeZone = ReadTimeZone();
        var retentionCount = Math.Clamp(configuration.GetValue("Backup:Daily:RetentionCount", 3), 1, 365);
        logger.LogInformation(
            "Automatic daily backups are enabled at {RunAt} in {TimeZone}; retaining {RetentionCount} snapshots.",
            runAt,
            timeZone.Id,
            retentionCount);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var nowUtc = DateTimeOffset.UtcNow;
                var localNow = TimeZoneInfo.ConvertTime(nowUtc, timeZone);
                var scheduledToday = localNow.Date.Add(runAt.ToTimeSpan());

                if (localNow.DateTime < scheduledToday)
                {
                    await DelayUntilAsync(scheduledToday, timeZone, stoppingToken);
                    continue;
                }

                await using var scope = scopeFactory.CreateAsyncScope();
                var backups = scope.ServiceProvider.GetRequiredService<IAxisBackupService>();
                var backupDate = DateOnly.FromDateTime(localNow.Date);
                var result = await backups.CreateDailyBackupAsync(backupDate, stoppingToken);
                logger.LogInformation("Daily Axis backup is ready: {BackupFile}.", result.FileName);

                await DelayUntilAsync(scheduledToday.AddDays(1), timeZone, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Automatic daily backup failed. Axis will retry in {RetryMinutes} minutes.", RetryDelay.TotalMinutes);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }

    private TimeOnly ReadRunTime()
    {
        var configured = configuration["Backup:Daily:RunAtLocalTime"];
        return TimeOnly.TryParseExact(configured, ["HH:mm", "H:mm"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var value)
            ? value
            : new TimeOnly(3, 0);
    }

    private TimeZoneInfo ReadTimeZone()
    {
        var configured = configuration["Backup:Daily:TimeZoneId"] ?? "Europe/Berlin";
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(configured);
        }
        catch (TimeZoneNotFoundException exception)
        {
            logger.LogWarning(exception, "Backup time zone {TimeZone} was not found. UTC will be used.", configured);
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException exception)
        {
            logger.LogWarning(exception, "Backup time zone {TimeZone} is invalid. UTC will be used.", configured);
            return TimeZoneInfo.Utc;
        }
    }

    private static Task DelayUntilAsync(DateTime scheduledLocal, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        var scheduledUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(scheduledLocal, DateTimeKind.Unspecified), timeZone);
        var delay = scheduledUtc - DateTime.UtcNow;
        return delay > TimeSpan.Zero ? Task.Delay(delay, cancellationToken) : Task.CompletedTask;
    }
}
