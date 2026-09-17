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
    }

    private static async Task<Guid> GetFirstIdAsync(HttpClient client, string path)
    {
        using var document = JsonDocument.Parse(await client.GetStringAsync(path));
        return document.RootElement[0].GetProperty("id").GetGuid();
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
