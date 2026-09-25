using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Axis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Axis.UnitTests;

public sealed class ActivityApiIntegrationTests
{
    [Fact]
    public async Task Starter_data_can_be_disabled_without_disabling_database_schema()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();

        using var areas = JsonDocument.Parse(await client.GetStringAsync("/api/life-areas"));
        using var templates = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));

        Assert.Empty(areas.RootElement.EnumerateArray());
        Assert.Empty(templates.RootElement.EnumerateArray());
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Starter_pack_keeps_dsa_flexible_and_adds_weekly_grooming()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();

        using var goals = JsonDocument.Parse(await client.GetStringAsync("/api/goals"));
        Assert.DoesNotContain(goals.RootElement.EnumerateArray(), goal => goal.GetProperty("title").GetString() == "DSA 250 list x6 repetitions");
        Assert.Contains(goals.RootElement.EnumerateArray(), goal => goal.GetProperty("title").GetString() == "Weekly grooming maintenance");

        using var templates = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        var grooming = templates.RootElement.EnumerateArray().Single(template => template.GetProperty("title").GetString() == "Grooming reset");
        var groomingId = grooming.GetProperty("id").GetGuid();

        using var rules = JsonDocument.Parse(await client.GetStringAsync($"/api/recurrence-rules?templateId={groomingId}"));
        var rule = Assert.Single(rules.RootElement.EnumerateArray());
        Assert.Equal("Weekly", rule.GetProperty("frequency").GetString());
        Assert.Equal(1, rule.GetProperty("interval").GetInt32());

        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Corrupt_database_stops_startup_before_any_application_writes()
    {
        await using var factory = new AxisApiFactory();
        var corruptBytes = "not-a-sqlite-database"u8.ToArray();
        await File.WriteAllBytesAsync(factory.DatabasePath, corruptBytes);

        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());

        Assert.Contains("integrity check failed", exception.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(corruptBytes, await File.ReadAllBytesAsync(factory.DatabasePath));
    }

    [Fact]
    public async Task Completed_workout_can_be_skipped_completed_again_and_deleted_without_corrupting_sqlite()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddHours(-1));

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.DeleteAsync($"/api/activities/{activityId}"), HttpStatusCode.NoContent);
        await AssertStatusAsync(await client.GetAsync("/api/dashboard/progress"), HttpStatusCode.OK);

        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Planned_future_activity_cannot_be_completed_but_skipped_activity_can_be_corrected_to_done()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddDays(1));

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.BadRequest);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);

        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Repeated_create_and_delete_operations_keep_the_database_consistent()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");

        for (var index = 0; index < 30; index++)
        {
            var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddMinutes(-index - 1));
            await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
            await AssertStatusAsync(await client.DeleteAsync($"/api/activities/{activityId}"), HttpStatusCode.NoContent);
        }

        await AssertStatusAsync(await client.GetAsync("/api/activities"), HttpStatusCode.OK);
        await AssertStatusAsync(await client.GetAsync("/api/dashboard/progress"), HttpStatusCode.OK);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Backdated_completed_activity_updates_and_rolls_back_goal_progress_consistently()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var goalId = await CreateCountGoalAsync(client, areaId);
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddDays(-1), "Completed", goalId);

        Assert.Equal(10m, await GetGoalCurrentValueAsync(client, goalId));
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        Assert.Equal(0m, await GetGoalCurrentValueAsync(client, goalId));
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        Assert.Equal(10m, await GetGoalCurrentValueAsync(client, goalId));
        await AssertStatusAsync(await client.DeleteAsync($"/api/activities/{activityId}"), HttpStatusCode.NoContent);
        Assert.Equal(0m, await GetGoalCurrentValueAsync(client, goalId));

        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Activity_later_today_can_be_completed_while_tomorrows_activity_stays_locked()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var offset = DateTimeOffset.Now.Offset;
        var laterToday = new DateTimeOffset(DateTime.Today.AddHours(23).AddMinutes(30), offset);
        var tomorrow = new DateTimeOffset(DateTime.Today.AddDays(1).AddHours(8), offset);
        var todayId = await CreateActivityAsync(client, areaId, laterToday, title: "Same-day routine");
        var tomorrowId = await CreateActivityAsync(client, areaId, tomorrow, title: "Tomorrow routine");

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{todayId}/complete", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{tomorrowId}/complete", null), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Routine_status_changes_upsert_one_linked_metric_entry_and_delete_cleans_it_up()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.Now, title: "Night retinoid");

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        var metricId = await GetMetricIdAsync(client, "Night retinoid");
        var entries = await GetMetricEntriesAsync(client, metricId);
        Assert.Single(entries);
        Assert.Equal(1m, entries[0].GetProperty("value").GetDecimal());

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        entries = await GetMetricEntriesAsync(client, metricId);
        Assert.Single(entries);
        Assert.Equal(0m, entries[0].GetProperty("value").GetDecimal());

        await AssertStatusAsync(await client.DeleteAsync($"/api/activities/{activityId}"), HttpStatusCode.NoContent);
        Assert.Empty(await GetMetricEntriesAsync(client, metricId));
    }

    [Fact]
    public async Task Daily_measurement_logs_create_all_linked_metrics_and_reject_dates_outside_the_three_day_window()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var yesterday = DateTimeOffset.Now.AddDays(-1);

        var nutritionId = await CreateCompletedMeasurementAsync(client, areaId, "Daily nutrition", yesterday,
            "Calories: 2310 · Protein: 142.5 · Carbohydrates: 260 · Fat: 71 · Fiber: 31");
        var stepsId = await CreateCompletedMeasurementAsync(client, areaId, "Steps", yesterday, "Quantity: 11234");
        var waterId = await CreateCompletedMeasurementAsync(client, areaId, "Water intake", yesterday, "Quantity: 2750");

        await AssertLinkedMetricAsync(client, "Calories", nutritionId, 2310m);
        await AssertLinkedMetricAsync(client, "Protein intake", nutritionId, 142.5m);
        await AssertLinkedMetricAsync(client, "Carbohydrates", nutritionId, 260m);
        await AssertLinkedMetricAsync(client, "Fat intake", nutritionId, 71m);
        await AssertLinkedMetricAsync(client, "Fiber intake", nutritionId, 31m);
        await AssertLinkedMetricAsync(client, "Steps", stepsId, 11234m);
        await AssertLinkedMetricAsync(client, "Water consumed", waterId, 2750m);

        var tooOld = await PostCompletedMeasurementAsync(client, areaId, "Steps", DateTimeOffset.Now.AddDays(-3), "Quantity: 8000");
        await AssertStatusAsync(tooOld, HttpStatusCode.BadRequest);
        var future = await PostCompletedMeasurementAsync(client, areaId, "Water intake", DateTimeOffset.Now.AddDays(1), "Quantity: 2500");
        await AssertStatusAsync(future, HttpStatusCode.BadRequest);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Daily_measurements_are_upserted_as_metrics_without_recurring_activity_templates()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var yesterday = DateOnly.FromDateTime(DateTime.Now.AddDays(-1));

        var first = await client.PostAsJsonAsync("/api/metrics/daily-measurements", new
        {
            recordedOn = yesterday,
            steps = 10850,
            waterMl = 2750,
            calories = 2310,
            protein = 142.5m,
            carbohydrates = 260,
            fat = 71,
            fiber = 31,
            notes = "Integration daily metrics"
        });
        await AssertStatusAsync(first, HttpStatusCode.OK);

        var correction = await client.PostAsJsonAsync("/api/metrics/daily-measurements", new
        {
            recordedOn = yesterday,
            steps = 11234,
            waterMl = (decimal?)null,
            calories = (decimal?)null,
            protein = (decimal?)null,
            carbohydrates = (decimal?)null,
            fat = (decimal?)null,
            fiber = (decimal?)null,
            notes = "Corrected step count"
        });
        await AssertStatusAsync(correction, HttpStatusCode.OK);

        var stepsMetricId = await GetMetricIdAsync(client, "Steps");
        var stepsEntries = (await GetMetricEntriesAsync(client, stepsMetricId))
            .Where(entry => entry.GetProperty("notes").GetString()!.Contains("[daily-measurements:"))
            .ToList();
        Assert.Single(stepsEntries);
        Assert.Equal(11234m, stepsEntries[0].GetProperty("value").GetDecimal());

        using var templates = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        Assert.All(templates.RootElement.EnumerateArray()
            .Where(item => new[] { "Daily nutrition", "Steps", "Water intake" }.Contains(item.GetProperty("title").GetString())),
            item => Assert.False(item.GetProperty("isActive").GetBoolean()));

        using var today = JsonDocument.Parse(await client.GetStringAsync("/api/dashboard/today"));
        var ledgerTitles = today.RootElement.GetProperty("recentDays").EnumerateArray()
            .SelectMany(day => day.GetProperty("activities").EnumerateArray())
            .Select(item => item.GetProperty("title").GetString())
            .ToList();
        Assert.DoesNotContain(ledgerTitles, title => title is "Daily nutrition" or "Steps" or "Water intake");

        await AssertStatusAsync(await client.PostAsJsonAsync("/api/metrics/daily-measurements", new
        {
            recordedOn = yesterday.AddDays(-2),
            steps = 8000
        }), HttpStatusCode.BadRequest);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Mood_create_update_and_delete_stay_synchronized_with_mood_metric()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/mood", new { recordedAt = DateTimeOffset.Now, score = 8, energy = 7, stress = 3, context = "Integration", notes = "Synced" });
        await AssertStatusAsync(response, HttpStatusCode.Created);
        using var created = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var moodId = created.RootElement.GetProperty("id").GetGuid();
        var metricId = await GetMetricIdAsync(client, "Mood");
        var entries = await GetMetricEntriesAsync(client, metricId);
        Assert.Contains(entries, item => item.GetProperty("notes").GetString()!.Contains($"[mood:{moodId}]"));

        await AssertStatusAsync(await client.PutAsJsonAsync($"/api/mood/{moodId}", new { recordedAt = DateTimeOffset.Now, score = 9, energy = 8, stress = 2, context = "Updated", notes = "Synced" }), HttpStatusCode.OK);
        entries = await GetMetricEntriesAsync(client, metricId);
        var linked = entries.Where(item => item.GetProperty("notes").GetString()!.Contains($"[mood:{moodId}]")).ToList();
        Assert.Single(linked);
        Assert.Equal(9m, linked[0].GetProperty("value").GetDecimal());

        await AssertStatusAsync(await client.DeleteAsync($"/api/mood/{moodId}"), HttpStatusCode.NoContent);
        entries = await GetMetricEntriesAsync(client, metricId);
        Assert.DoesNotContain(entries, item => item.GetProperty("notes").GetString()!.Contains($"[mood:{moodId}]"));
    }

    [Fact]
    public async Task Today_dashboard_limits_execution_ledger_to_today_and_previous_two_days()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var offset = DateTimeOffset.Now.Offset;
        var yesterday = new DateTimeOffset(DateTime.Today.AddDays(-1).AddHours(9), offset);
        var twoDaysAgo = new DateTimeOffset(DateTime.Today.AddDays(-2).AddHours(9), offset);
        var threeDaysAgo = new DateTimeOffset(DateTime.Today.AddDays(-3).AddHours(9), offset);

        var completedId = await CreateActivityAsync(client, areaId, yesterday, title: "Recent completed marker");
        var skippedId = await CreateActivityAsync(client, areaId, twoDaysAgo, title: "Recent skipped marker");
        await CreateActivityAsync(client, areaId, threeDaysAgo, title: "Old hidden marker");
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{completedId}/complete", null), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{skippedId}/skip", null), HttpStatusCode.OK);

        using var document = JsonDocument.Parse(await client.GetStringAsync("/api/dashboard/today"));
        var recentDays = document.RootElement.GetProperty("recentDays").EnumerateArray().ToList();
        var activities = recentDays
            .SelectMany(day => day.GetProperty("activities").EnumerateArray())
            .Select(item => (Title: item.GetProperty("title").GetString(), Status: item.GetProperty("status").GetString()))
            .ToList();

        Assert.Equal(3, recentDays.Count);
        Assert.Contains(activities, item => item.Title == "Recent completed marker" && item.Status == "Completed");
        Assert.Contains(activities, item => item.Title == "Recent skipped marker" && item.Status == "Skipped");
        Assert.DoesNotContain(activities, item => item.Title == "Old hidden marker");
        Assert.DoesNotContain(activities, item => item.Title is "Daily nutrition" or "Steps" or "Water intake");
    }

    private static async Task<Guid> GetFirstIdAsync(HttpClient client, string path)
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync(path));
        return document.RootElement[0].GetProperty("id").GetGuid();
    }

    private static async Task<Guid> GetMetricIdAsync(HttpClient client, string name)
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync("/api/metrics"));
        return document.RootElement.EnumerateArray().Single(item => item.GetProperty("name").GetString() == name).GetProperty("id").GetGuid();
    }

    private static async Task<List<JsonElement>> GetMetricEntriesAsync(HttpClient client, Guid metricId)
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync($"/api/metrics/{metricId}/entries"));
        return document.RootElement.EnumerateArray().Select(item => item.Clone()).ToList();
    }

    private static async Task AssertLinkedMetricAsync(HttpClient client, string metricName, Guid activityId, decimal expectedValue)
    {
        var metricId = await GetMetricIdAsync(client, metricName);
        var linked = (await GetMetricEntriesAsync(client, metricId))
            .Single(entry => entry.GetProperty("notes").GetString()!.Contains($"[activity:{activityId}]"));
        Assert.Equal(expectedValue, linked.GetProperty("value").GetDecimal());
    }

    private static async Task<Guid> CreateCompletedMeasurementAsync(HttpClient client, Guid lifeAreaId, string title, DateTimeOffset recordedAt, string notes)
    {
        var response = await PostCompletedMeasurementAsync(client, lifeAreaId, title, recordedAt, notes);
        await AssertStatusAsync(response, HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static Task<HttpResponseMessage> PostCompletedMeasurementAsync(HttpClient client, Guid lifeAreaId, string title, DateTimeOffset recordedAt, string notes)
    {
        return client.PostAsJsonAsync("/api/activities", new
        {
            lifeAreaId,
            goalId = (Guid?)null,
            milestoneId = (Guid?)null,
            templateId = (Guid?)null,
            title,
            description = "Measurement integration test",
            plannedStartAt = recordedAt.AddMinutes(-1),
            plannedEndAt = recordedAt,
            actualStartAt = recordedAt.AddMinutes(-1),
            actualEndAt = recordedAt,
            durationMinutes = 1,
            status = "Completed",
            energyCost = "Low",
            mentalLoad = "Low",
            physicalLoad = "Low",
            points = 3,
            notes
        });
    }

    private static async Task<Guid> CreateCountGoalAsync(HttpClient client, Guid lifeAreaId)
    {
        var response = await client.PostAsJsonAsync("/api/goals", new
        {
            lifeAreaId,
            title = "Integration count goal",
            description = "Activity transition accounting",
            status = "Active",
            priority = "Secondary",
            progressType = "CountBased",
            currentValue = 0,
            targetValue = 10,
            unit = "sessions",
            targetDate = (string?)null,
            maintenanceThreshold = 80,
            maintenanceTargetPerWeek = (int?)null,
            decayRatePercentPerWeek = 0
        });
        await AssertStatusAsync(response, HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<decimal> GetGoalCurrentValueAsync(HttpClient client, Guid goalId)
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync($"/api/goals/{goalId}"));
        return document.RootElement.GetProperty("currentValue").GetDecimal();
    }

    private static async Task<Guid> CreateActivityAsync(HttpClient client, Guid lifeAreaId, DateTimeOffset plannedStart, string status = "Planned", Guid? goalId = null, string title = "Hypertrophy workout integration test")
    {
        var response = await client.PostAsJsonAsync("/api/activities", new
        {
            lifeAreaId,
            goalId,
            milestoneId = (Guid?)null,
            templateId = (Guid?)null,
            title,
            description = "SQLite lifecycle test",
            plannedStartAt = plannedStart,
            plannedEndAt = plannedStart.AddMinutes(60),
            actualStartAt = (DateTimeOffset?)null,
            actualEndAt = (DateTimeOffset?)null,
            durationMinutes = 60,
            status,
            energyCost = "High",
            mentalLoad = "Medium",
            physicalLoad = "High",
            points = 10,
            notes = ""
        });
        await AssertStatusAsync(response, HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task AssertStatusAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        if (response.StatusCode == expected)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync();
        Assert.Fail($"Expected {(int)expected}, received {(int)response.StatusCode}: {body}");
    }

    private sealed class AxisApiFactory : WebApplicationFactory<Program>, IAsyncDisposable
    {
        private readonly bool _seedData;

        public AxisApiFactory(bool seedData = true)
        {
            _seedData = seedData;
        }

        public string DatabasePath { get; } = Path.Combine(Path.GetTempPath(), $"axis-integration-{Guid.NewGuid():N}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = DatabasePath,
                ForeignKeys = true,
                Pooling = false,
                DefaultTimeout = 5
            }.ToString();

            builder.UseSetting("ConnectionStrings:Axis", connectionString);
            builder.UseSetting("SeedData", _seedData.ToString());
            builder.UseSetting("Backup:Directory", Path.Combine(Path.GetTempPath(), $"axis-backups-{Guid.NewGuid():N}"));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<AxisDbContext>();
                services.RemoveAll<DbContextOptions<AxisDbContext>>();
                services.AddDbContext<AxisDbContext>(options => options.UseSqlite(connectionString));
            });
        }

        public async Task AssertDatabaseIntegrityAsync()
        {
            await using var connection = new SqliteConnection($"Data Source={DatabasePath};Pooling=False");
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA integrity_check;";
            Assert.Equal("ok", await command.ExecuteScalarAsync());
        }

        public new async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            DeleteIfPresent(DatabasePath);
            DeleteIfPresent($"{DatabasePath}-wal");
            DeleteIfPresent($"{DatabasePath}-shm");
        }

        private static void DeleteIfPresent(string path)
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
