using System.Net;
using System.Net.Http.Json;
using System.IO.Compression;
using System.Text.Json;
using Axis.Application.Backup;
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
    public async Task Health_reports_the_running_version_and_ready_database()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();

        using var health = JsonDocument.Parse(await client.GetStringAsync("/api/health"));
        Assert.Equal("healthy", health.RootElement.GetProperty("status").GetString());
        Assert.Equal("ready", health.RootElement.GetProperty("database").GetString());
        Assert.False(string.IsNullOrWhiteSpace(health.RootElement.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task Pre_upgrade_backup_is_valid_and_created_only_once_per_version()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();
        await AssertStatusAsync(await client.GetAsync("/api/health"), HttpStatusCode.OK);

        await using var scope = factory.Services.CreateAsyncScope();
        var backups = scope.ServiceProvider.GetRequiredService<IAxisBackupService>();
        var first = await backups.CreatePreUpgradeBackupAsync("9.8.7");
        var second = await backups.CreatePreUpgradeBackupAsync("9.8.7");

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first.FullPath, second.FullPath);
        Assert.True(File.Exists(first.FullPath));
        await using var stream = File.OpenRead(first.FullPath);
        var validation = await backups.ValidateAsync(stream);
        Assert.True(validation.IsValid, validation.Message);
        Assert.Equal("9.8.7", validation.Manifest?.AppVersion);
    }

    [Fact]
    public async Task Corrupt_database_inside_backup_is_rejected_without_changing_current_data()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/api/focus-notes", new
        {
            title = "Must survive invalid import",
            content = "Sentinel",
            label = "Safety",
            color = "#39d9e6",
            isPinned = true,
            isArchived = false
        });
        await AssertStatusAsync(created, HttpStatusCode.Created);

        await using var invalidBackup = new MemoryStream();
        using (var archive = new ZipArchive(invalidBackup, ZipArchiveMode.Create, leaveOpen: true))
        {
            var manifestEntry = archive.CreateEntry("manifest.json");
            await using (var manifestStream = manifestEntry.Open())
            {
                await JsonSerializer.SerializeAsync(manifestStream, new BackupManifest("Axis", "0.1.0", 1, DateTimeOffset.UtcNow, "axis.db"));
            }

            var databaseEntry = archive.CreateEntry("axis.db");
            await using var databaseStream = databaseEntry.Open();
            await databaseStream.WriteAsync("not-a-sqlite-database"u8.ToArray());
        }
        invalidBackup.Position = 0;

        using var form = new MultipartFormDataContent();
        using var content = new StreamContent(invalidBackup);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/zip");
        form.Add(content, "file", "invalid-axis-backup.zip");
        await AssertStatusAsync(await client.PostAsync("/api/backup/import", form), HttpStatusCode.BadRequest);

        using var notes = JsonDocument.Parse(await client.GetStringAsync("/api/focus-notes?includeArchived=true"));
        Assert.Contains(notes.RootElement.EnumerateArray(), item => item.GetProperty("title").GetString() == "Must survive invalid import");
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Existing_backup_format_round_trips_without_losing_data()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/focus-notes", new
        {
            title = "Keep this through backup",
            content = "Desktop and Docker must share the same backup contract.",
            label = "Safety",
            color = "#39d9e6",
            isPinned = true,
            isArchived = false
        });
        await AssertStatusAsync(created, HttpStatusCode.Created);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var id = createdJson.RootElement.GetProperty("id").GetGuid();

        var backupResponse = await client.GetAsync("/api/backup/export");
        await AssertStatusAsync(backupResponse, HttpStatusCode.OK);
        var backupBytes = await backupResponse.Content.ReadAsByteArrayAsync();

        await AssertStatusAsync(await client.DeleteAsync($"/api/focus-notes/{id}"), HttpStatusCode.NoContent);

        using var form = new MultipartFormDataContent();
        using var backupContent = new ByteArrayContent(backupBytes);
        backupContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/zip");
        form.Add(backupContent, "file", "axis-backup-existing.zip");
        await AssertStatusAsync(await client.PostAsync("/api/backup/import", form), HttpStatusCode.OK);

        using var restored = JsonDocument.Parse(await client.GetStringAsync("/api/focus-notes?includeArchived=true"));
        Assert.Contains(restored.RootElement.EnumerateArray(), item => item.GetProperty("id").GetGuid() == id);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Focus_notes_support_create_edit_archive_list_and_delete()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/focus-notes", new
        {
            title = "Learning wins this week",
            content = "Protect the best evening hours for interview preparation.",
            label = "This week",
            color = "#7f6cff",
            isPinned = true,
            isArchived = false
        });
        await AssertStatusAsync(created, HttpStatusCode.Created);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var id = createdJson.RootElement.GetProperty("id").GetGuid();

        using var active = JsonDocument.Parse(await client.GetStringAsync("/api/focus-notes"));
        Assert.Contains(active.RootElement.EnumerateArray(), item => item.GetProperty("id").GetGuid() == id);

        await AssertStatusAsync(await client.PutAsJsonAsync($"/api/focus-notes/{id}", new
        {
            title = "Learning stays first",
            content = "Archive after the week is reviewed.",
            label = "Learning",
            color = "#39d9e6",
            isPinned = false,
            isArchived = true
        }), HttpStatusCode.OK);

        using var activeAfterArchive = JsonDocument.Parse(await client.GetStringAsync("/api/focus-notes"));
        Assert.DoesNotContain(activeAfterArchive.RootElement.EnumerateArray(), item => item.GetProperty("id").GetGuid() == id);
        using var all = JsonDocument.Parse(await client.GetStringAsync("/api/focus-notes?includeArchived=true"));
        Assert.Contains(all.RootElement.EnumerateArray(), item => item.GetProperty("id").GetGuid() == id && item.GetProperty("isArchived").GetBoolean());

        await AssertStatusAsync(await client.DeleteAsync($"/api/focus-notes/{id}"), HttpStatusCode.NoContent);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Job_pipeline_crud_and_backup_round_trip_preserve_stages_and_checklists()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/job-applications", JobApplicationPayload("Scouted"));
        await AssertStatusAsync(created, HttpStatusCode.Created);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var applicationId = createdJson.RootElement.GetProperty("id").GetGuid();
        var defaultStages = createdJson.RootElement.GetProperty("stages").EnumerateArray().ToList();
        Assert.Equal(4, defaultStages.Count);
        Assert.All(defaultStages, stage => Assert.NotEmpty(stage.GetProperty("checklist").EnumerateArray()));

        var stageResponse = await client.PostAsJsonAsync($"/api/job-applications/{applicationId}/stages", new
        {
            title = "Technical interview 2",
            status = "Scheduled",
            focus = "System design and trade-offs",
            notes = "Prepare one architecture walkthrough.",
            scheduledAt = DateTimeOffset.UtcNow.AddDays(5),
            completedAt = (DateTimeOffset?)null,
            sortOrder = (int?)null
        });
        await AssertStatusAsync(stageResponse, HttpStatusCode.Created);
        using var stageJson = JsonDocument.Parse(await stageResponse.Content.ReadAsStringAsync());
        var stageId = stageJson.RootElement.GetProperty("id").GetGuid();

        var checklistResponse = await client.PostAsJsonAsync($"/api/job-applications/stages/{stageId}/checklist", new
        {
            title = "Practice capacity estimation",
            notes = "Use the target company's scale.",
            isCompleted = false,
            completedAt = (DateTimeOffset?)null,
            sortOrder = (int?)null
        });
        await AssertStatusAsync(checklistResponse, HttpStatusCode.Created);
        using var checklistJson = JsonDocument.Parse(await checklistResponse.Content.ReadAsStringAsync());
        var checklistId = checklistJson.RootElement.GetProperty("id").GetGuid();

        await AssertStatusAsync(await client.PutAsJsonAsync($"/api/job-applications/checklist/{checklistId}", new
        {
            title = "Practice capacity estimation",
            notes = "Completed in 18 minutes.",
            isCompleted = true,
            completedAt = DateTimeOffset.UtcNow,
            sortOrder = 0
        }), HttpStatusCode.OK);
        await AssertStatusAsync(await client.PutAsJsonAsync($"/api/job-applications/{applicationId}", JobApplicationPayload("Interviewing")), HttpStatusCode.OK);

        var backupResponse = await client.GetAsync("/api/backup/export");
        await AssertStatusAsync(backupResponse, HttpStatusCode.OK);
        var backupBytes = await backupResponse.Content.ReadAsByteArrayAsync();
        await AssertStatusAsync(await client.DeleteAsync($"/api/job-applications/{applicationId}"), HttpStatusCode.NoContent);

        using var form = new MultipartFormDataContent();
        using var backupContent = new ByteArrayContent(backupBytes);
        backupContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/zip");
        form.Add(backupContent, "file", "axis-job-pipeline.zip");
        await AssertStatusAsync(await client.PostAsync("/api/backup/import", form), HttpStatusCode.OK);

        using var restored = JsonDocument.Parse(await client.GetStringAsync("/api/job-applications?includeArchived=true"));
        var application = restored.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == applicationId);
        Assert.Equal("Interviewing", application.GetProperty("status").GetString());
        var restoredStage = application.GetProperty("stages").EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == stageId);
        var restoredCheck = restoredStage.GetProperty("checklist").EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == checklistId);
        Assert.True(restoredCheck.GetProperty("isCompleted").GetBoolean());
        Assert.Equal("Completed in 18 minutes.", restoredCheck.GetProperty("notes").GetString());
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Backup_created_before_job_pipeline_tables_is_upgraded_immediately_after_import()
    {
        await using var factory = new AxisApiFactory(seedData: false);
        using var client = factory.CreateClient();

        await using (var connection = new SqliteConnection($"Data Source={factory.DatabasePath};Pooling=False"))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                PRAGMA foreign_keys=OFF;
                DROP TABLE "JobPreparationItems";
                DROP TABLE "JobApplicationStages";
                DROP TABLE "JobApplications";
                PRAGMA foreign_keys=ON;
                """;
            await command.ExecuteNonQueryAsync();
        }

        var oldBackupResponse = await client.GetAsync("/api/backup/export");
        await AssertStatusAsync(oldBackupResponse, HttpStatusCode.OK);
        var oldBackupBytes = await oldBackupResponse.Content.ReadAsByteArrayAsync();

        using var form = new MultipartFormDataContent();
        using var backupContent = new ByteArrayContent(oldBackupBytes);
        backupContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/zip");
        form.Add(backupContent, "file", "axis-backup-before-job-pipeline.zip");
        await AssertStatusAsync(await client.PostAsync("/api/backup/import", form), HttpStatusCode.OK);

        using var applications = JsonDocument.Parse(await client.GetStringAsync("/api/job-applications?includeArchived=true"));
        Assert.Empty(applications.RootElement.EnumerateArray());
        await AssertStatusAsync(await client.PostAsJsonAsync("/api/job-applications", JobApplicationPayload("Scouted")), HttpStatusCode.Created);
        await factory.AssertDatabaseIntegrityAsync();
    }

    private static object JobApplicationPayload(string status) => new
    {
        companyName = "Vapor Systems",
        positionTitle = "Senior Software Engineer",
        status,
        workMode = "Hybrid",
        employmentType = "Full-time",
        location = "Berlin",
        country = "Germany",
        salaryMin = 80000,
        salaryMax = 95000,
        currency = "EUR",
        desireRating = 9,
        fitRating = 8,
        priority = 5,
        companyUrl = "https://example.com",
        postingUrl = "https://example.com/job",
        applicationUrl = "https://example.com/apply",
        source = "Company careers page",
        contactName = "Recruiter",
        contactEmail = "recruiter@example.com",
        jobDescription = "Build reliable systems.",
        notes = "High-priority role.",
        discoveredAt = DateTimeOffset.UtcNow.AddDays(-2),
        appliedAt = (DateTimeOffset?)null,
        lastContactAt = (DateTimeOffset?)null,
        followUpAt = DateTimeOffset.UtcNow.AddDays(3),
        deadlineAt = DateTimeOffset.UtcNow.AddDays(10),
        decisionAt = (DateTimeOffset?)null,
        isArchived = false
    };

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
    public async Task Manually_unlinked_template_stays_unlinked_on_normal_restart()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        using var before = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        var creatine = before.RootElement.EnumerateArray().Single(item => item.GetProperty("title").GetString() == "Creatine dose");
        var templateId = creatine.GetProperty("id").GetGuid();

        await AssertStatusAsync(await client.PutAsJsonAsync($"/api/activity-templates/{templateId}", new
        {
            lifeAreaId = creatine.GetProperty("lifeAreaId").GetGuid(),
            goalId = (Guid?)null,
            title = "Creatine dose",
            description = creatine.GetProperty("description").GetString(),
            defaultDurationMinutes = creatine.GetProperty("defaultDurationMinutes").GetInt32(),
            energyCost = creatine.GetProperty("energyCost").GetString(),
            mentalLoad = creatine.GetProperty("mentalLoad").GetString(),
            physicalLoad = creatine.GetProperty("physicalLoad").GetString(),
            defaultPoints = creatine.GetProperty("defaultPoints").GetInt32(),
            isActive = true
        }), HttpStatusCode.OK);

        await factory.Services.InitializeAxisDatabaseAsync(seedData: false);

        using var after = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        var unchanged = after.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == templateId);
        Assert.Equal(JsonValueKind.Null, unchanged.GetProperty("goalId").ValueKind);
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Linked_template_generated_activity_and_goal_use_one_shared_progress_path()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var goalId = await CreateCountGoalAsync(client, areaId);

        var templateResponse = await client.PostAsJsonAsync("/api/activity-templates", new
        {
            lifeAreaId = areaId,
            goalId,
            title = "Interconnected system design practice",
            description = "One source for logging, goals, and momentum.",
            defaultDurationMinutes = 45,
            energyCost = "Medium",
            mentalLoad = "High",
            physicalLoad = "Low",
            defaultPoints = 10,
            isActive = true
        });
        await AssertStatusAsync(templateResponse, HttpStatusCode.Created);
        using var templateJson = JsonDocument.Parse(await templateResponse.Content.ReadAsStringAsync());
        var templateId = templateJson.RootElement.GetProperty("id").GetGuid();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var ruleResponse = await client.PostAsJsonAsync("/api/recurrence-rules", new
        {
            templateId,
            frequency = "Daily",
            interval = 1,
            daysOfWeek = "",
            startDate = today,
            endDate = today
        });
        await AssertStatusAsync(ruleResponse, HttpStatusCode.Created);
        using var ruleJson = JsonDocument.Parse(await ruleResponse.Content.ReadAsStringAsync());
        var ruleId = ruleJson.RootElement.GetProperty("id").GetGuid();

        var generatedResponse = await client.PostAsJsonAsync($"/api/recurrence-rules/{ruleId}/generate", new { from = today, to = today });
        await AssertStatusAsync(generatedResponse, HttpStatusCode.OK);
        using var generated = JsonDocument.Parse(await generatedResponse.Content.ReadAsStringAsync());
        var activity = Assert.Single(generated.RootElement.GetProperty("activities").EnumerateArray());
        Assert.Equal(goalId, activity.GetProperty("goalId").GetGuid());
        var activityId = activity.GetProperty("id").GetGuid();

        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        Assert.Equal(10m, await GetGoalCurrentValueAsync(client, goalId));

        using var templates = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        var linkedTemplate = templates.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == templateId);
        Assert.Equal(goalId, linkedTemplate.GetProperty("goalId").GetGuid());
        await factory.AssertDatabaseIntegrityAsync();
    }

    [Fact]
    public async Task Deleting_goal_preserves_activity_metric_and_template_history_by_unlinking_them()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var goalId = await CreateCountGoalAsync(client, areaId);
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddHours(-1), "Completed", goalId, "Connected history test");

        var metricResponse = await client.PostAsJsonAsync("/api/metrics", new
        {
            lifeAreaId = areaId,
            goalId,
            name = "Connected metric test",
            unit = "points",
            valueType = "Number",
            targetValue = 100,
            sortOrder = 999,
            isActive = true
        });
        await AssertStatusAsync(metricResponse, HttpStatusCode.Created);
        using var metricJson = JsonDocument.Parse(await metricResponse.Content.ReadAsStringAsync());
        var metricId = metricJson.RootElement.GetProperty("id").GetGuid();

        var templateResponse = await client.PostAsJsonAsync("/api/activity-templates", new
        {
            lifeAreaId = areaId,
            goalId,
            title = "Connected template test",
            description = "Must survive goal deletion.",
            defaultDurationMinutes = 30,
            energyCost = "Medium",
            mentalLoad = "Medium",
            physicalLoad = "Low",
            defaultPoints = 5,
            isActive = true
        });
        await AssertStatusAsync(templateResponse, HttpStatusCode.Created);
        using var templateJson = JsonDocument.Parse(await templateResponse.Content.ReadAsStringAsync());
        var templateId = templateJson.RootElement.GetProperty("id").GetGuid();

        await AssertStatusAsync(await client.DeleteAsync($"/api/goals/{goalId}"), HttpStatusCode.NoContent);

        using var activities = JsonDocument.Parse(await client.GetStringAsync("/api/activities"));
        var preservedActivity = activities.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == activityId);
        Assert.Equal(JsonValueKind.Null, preservedActivity.GetProperty("goalId").ValueKind);
        using var metrics = JsonDocument.Parse(await client.GetStringAsync("/api/metrics"));
        var preservedMetric = metrics.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == metricId);
        Assert.Equal(JsonValueKind.Null, preservedMetric.GetProperty("goalId").ValueKind);
        using var templates = JsonDocument.Parse(await client.GetStringAsync("/api/activity-templates"));
        var preservedTemplate = templates.RootElement.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == templateId);
        Assert.Equal(JsonValueKind.Null, preservedTemplate.GetProperty("goalId").ValueKind);
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
    public async Task One_completed_log_can_advance_and_reverse_multiple_goal_units()
    {
        await using var factory = new AxisApiFactory();
        using var client = factory.CreateClient();
        var areaId = await GetFirstIdAsync(client, "/api/life-areas");
        var goalId = await CreateCountGoalAsync(client, areaId);
        var activityId = await CreateActivityAsync(client, areaId, DateTimeOffset.UtcNow.AddHours(-1), "Completed", goalId, "Four DSA problems", "[axis-log] [progress:4]");

        Assert.Equal(40m, await GetGoalCurrentValueAsync(client, goalId));
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/skip", null), HttpStatusCode.OK);
        Assert.Equal(0m, await GetGoalCurrentValueAsync(client, goalId));
        await AssertStatusAsync(await client.PostAsync($"/api/activities/{activityId}/complete", null), HttpStatusCode.OK);
        Assert.Equal(40m, await GetGoalCurrentValueAsync(client, goalId));
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

    private static async Task<Guid> CreateActivityAsync(HttpClient client, Guid lifeAreaId, DateTimeOffset plannedStart, string status = "Planned", Guid? goalId = null, string title = "Hypertrophy workout integration test", string notes = "")
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
            notes
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
        public string BackupDirectory { get; } = Path.Combine(Path.GetTempPath(), $"axis-backups-{Guid.NewGuid():N}");

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
            builder.UseSetting("Backup:Directory", BackupDirectory);
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
            if (Directory.Exists(BackupDirectory)) Directory.Delete(BackupDirectory, recursive: true);
        }

        private static void DeleteIfPresent(string path)
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
