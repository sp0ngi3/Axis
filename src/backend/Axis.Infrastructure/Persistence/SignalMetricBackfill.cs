using System.Globalization;
using Axis.Domain;
using Microsoft.EntityFrameworkCore;

namespace Axis.Infrastructure.Persistence;

internal static class SignalMetricBackfill
{
    public static async Task RunAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        var metrics = await dbContext.Metrics.ToDictionaryAsync(
            metric => metric.Name,
            StringComparer.OrdinalIgnoreCase,
            cancellationToken);
        var entries = await dbContext.MetricEntries.ToListAsync(cancellationToken);

        await BackfillMoodEntriesAsync(dbContext, metrics, entries, cancellationToken);
        await BackfillActivityEntriesAsync(dbContext, metrics, entries, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task BackfillMoodEntriesAsync(
        AxisDbContext dbContext,
        IReadOnlyDictionary<string, Metric> metrics,
        ICollection<MetricEntry> entries,
        CancellationToken cancellationToken)
    {
        var moods = await dbContext.MoodEntries.AsNoTracking().ToListAsync(cancellationToken);
        if (!metrics.TryGetValue("Mood", out var moodMetric)) return;

        foreach (var mood in moods)
        {
            var marker = $"[mood:{mood.Id}]";
            if (entries.Any(entry => entry.Notes.Contains(marker, StringComparison.Ordinal))) continue;

            var linkedEntry = new MetricEntry
            {
                MetricId = moodMetric.Id,
                Value = mood.Score,
                RecordedAt = mood.RecordedAt,
                Notes = $"{marker} Mood log · energy {mood.Energy}/10 · stress {mood.Stress}/10."
            };
            dbContext.MetricEntries.Add(linkedEntry);
            entries.Add(linkedEntry);
        }
    }

    private static async Task BackfillActivityEntriesAsync(
        AxisDbContext dbContext,
        IReadOnlyDictionary<string, Metric> metrics,
        ICollection<MetricEntry> entries,
        CancellationToken cancellationToken)
    {
        var activities = await dbContext.Activities.AsNoTracking()
            .Where(activity => activity.Status == ActivityStatus.Completed
                || activity.Status == ActivityStatus.Skipped
                || activity.Status == ActivityStatus.Cancelled)
            .ToListAsync(cancellationToken);

        foreach (var activity in activities)
        {
            var marker = $"[activity:{activity.Id}]";
            if (entries.Any(entry => entry.Notes.Contains(marker, StringComparison.Ordinal))) continue;

            var mappedMetrics = MapActivityMetrics(activity);
            if (mappedMetrics.Count == 0) continue;

            var recordedAt = activity.ActualEndAt ?? activity.PlannedStartAt ?? activity.CreatedAt;
            foreach (var mappedMetric in mappedMetrics)
            {
                if (!metrics.TryGetValue(mappedMetric.Name, out var metric)) continue;

                var legacyEntry = entries.FirstOrDefault(entry =>
                    entry.MetricId == metric.Id
                    && entry.Notes.StartsWith("Quick logged", StringComparison.OrdinalIgnoreCase)
                    && Math.Abs((entry.RecordedAt - recordedAt).TotalMinutes) <= 10);

                if (legacyEntry is not null)
                {
                    legacyEntry.Value = mappedMetric.Value;
                    legacyEntry.RecordedAt = recordedAt;
                    legacyEntry.Notes = $"{marker} Synced from {activity.Title}.";
                    continue;
                }

                var linkedEntry = new MetricEntry
                {
                    MetricId = metric.Id,
                    Value = mappedMetric.Value,
                    RecordedAt = recordedAt,
                    Notes = $"{marker} Synced from {activity.Title}."
                };
                dbContext.MetricEntries.Add(linkedEntry);
                entries.Add(linkedEntry);
            }
        }
    }

    private static List<(string Name, decimal Value)> MapActivityMetrics(Activity activity)
    {
        var completed = activity.Status == ActivityStatus.Completed;
        var quantity = ParseQuantity(activity.Notes);

        return activity.Title switch
        {
            "Creatine dose" => [("Creatine dose", completed ? 5m * quantity : 0m)],
            "Desk mobility reset" => [("Mobility session", completed ? 1m : 0m)],
            "Hypertrophy workout" => [("Strength training session", completed ? 1m : 0m)],
            "No alcohol check-in" => [("Alcohol-free day", completed ? 1m : 0m)],
            "No vape check-in" => [("Vape-free day", completed ? 1m : 0m)],
            "Diet check-in" => [("Diet adherence", completed ? 1m : 0m)],
            "SPF 30+" => [("SPF 30+", completed ? 1m : 0m)],
            "Night retinoid" => [("Night retinoid", completed ? 1m : 0m)],
            "Floss teeth" => [("Flossing", completed ? 1m : 0m)],
            "Outdoor walk" => [("Outdoor walk", completed ? activity.DurationMinutes : 0m)],
            "Sleep log" when completed && HasQuantity(activity.Notes) => [("Sleep duration", quantity)],
            "Steps" when completed && HasQuantity(activity.Notes) => [("Steps", quantity)],
            "Water intake" when completed && HasQuantity(activity.Notes) => [("Water consumed", quantity)],
            "Daily nutrition" when completed => MapNutritionMetrics(activity.Notes),
            _ => []
        };
    }

    private static List<(string Name, decimal Value)> MapNutritionMetrics(string notes)
    {
        var mappings = new (string Marker, string Metric)[]
        {
            ("Calories", "Calories"),
            ("Protein", "Protein intake"),
            ("Carbohydrates", "Carbohydrates"),
            ("Fat", "Fat intake"),
            ("Fiber", "Fiber intake")
        };

        return mappings
            .Select(mapping => (mapping.Metric, Value: ParseNamedValue(notes, mapping.Marker)))
            .Where(mapping => mapping.Value is not null)
            .Select(mapping => (mapping.Metric, mapping.Value!.Value))
            .ToList();
    }

    private static bool HasQuantity(string notes)
    {
        return notes.Contains("Quantity:", StringComparison.OrdinalIgnoreCase);
    }

    private static decimal ParseQuantity(string notes)
    {
        var parsed = ParseNamedValue(notes, "Quantity");
        return parsed ?? 1m;
    }

    private static decimal? ParseNamedValue(string notes, string marker)
    {
        var markerIndex = notes.IndexOf($"{marker}:", StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0) return null;

        var value = notes[(markerIndex + marker.Length + 1)..]
            .TrimStart()
            .Split([' ', '·', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault();

        return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? Math.Max(0, parsed)
            : null;
    }
}
