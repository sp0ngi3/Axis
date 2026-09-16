using System.Text.Json.Serialization;
using Axis.Application.Backup;
using Axis.Application.Progress;
using Axis.Application.Reviews;
using Axis.Domain;
using Axis.Infrastructure;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddAxisInfrastructure(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? ["http://localhost:3001", "http://localhost:5174"];

        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});
builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

await app.Services.InitializeAxisDatabaseAsync();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", app = "Axis", time = DateTimeOffset.UtcNow }));

MapLifeAreas(app);
MapGoals(app);
MapMilestones(app);
MapActivityTemplates(app);
MapRecurrenceRules(app);
MapActivities(app);
MapMetrics(app);
MapReviews(app);
MapDashboard(app);
MapBackup(app);

app.Run();

static void MapLifeAreas(WebApplication app)
{
    var group = app.MapGroup("/api/life-areas");

    group.MapGet("/", async (AxisDbContext db, CancellationToken ct) =>
    {
        var areas = await db.LifeAreas
            .OrderByDescending(area => area.IsActive)
            .ThenByDescending(area => area.PriorityWeight)
            .ThenBy(area => area.Name)
            .ToListAsync(ct);

        return Results.Ok(areas);
    });

    group.MapPost("/", async (LifeAreaRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest("Name is required.");
        }

        var area = new LifeArea();
        Apply(area, request);
        db.LifeAreas.Add(area);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/life-areas/{area.Id}", area);
    });

    group.MapPut("/{id:guid}", async (Guid id, LifeAreaRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var area = await db.LifeAreas.FindAsync([id], ct);
        if (area is null)
        {
            return Results.NotFound();
        }

        Apply(area, request);
        await db.SaveChangesAsync(ct);
        return Results.Ok(area);
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var area = await db.LifeAreas.FindAsync([id], ct);
        if (area is null)
        {
            return Results.NotFound();
        }

        db.LifeAreas.Remove(area);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    static void Apply(LifeArea area, LifeAreaRequest request)
    {
        area.Name = request.Name.Trim();
        area.Description = request.Description?.Trim() ?? string.Empty;
        area.Color = string.IsNullOrWhiteSpace(request.Color) ? "#4f8cff" : request.Color.Trim();
        area.Icon = string.IsNullOrWhiteSpace(request.Icon) ? "circle" : request.Icon.Trim();
        area.PriorityWeight = Math.Clamp(request.PriorityWeight, 0, 100);
        area.CurrentScore = Math.Clamp(request.CurrentScore, 0, 100);
        area.TargetScore = Math.Clamp(request.TargetScore, 0, 100);
        area.IsActive = request.IsActive;
    }
}

static void MapGoals(WebApplication app)
{
    var group = app.MapGroup("/api/goals");

    group.MapGet("/", async (Guid? lifeAreaId, GoalStatus? status, AxisDbContext db, CancellationToken ct) =>
    {
        var query = db.Goals.Include(goal => goal.LifeArea).Include(goal => goal.Milestones).AsQueryable();

        if (lifeAreaId is not null)
        {
            query = query.Where(goal => goal.LifeAreaId == lifeAreaId);
        }

        if (status is not null)
        {
            query = query.Where(goal => goal.Status == status);
        }

        var goals = await query
            .OrderBy(goal => goal.Status)
            .ThenBy(goal => goal.Priority)
            .ThenBy(goal => goal.TargetDate)
            .ToListAsync(ct);

        return Results.Ok(goals.Select(ToGoalResponse));
    });

    group.MapGet("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var goal = await db.Goals
            .Include(item => item.LifeArea)
            .Include(item => item.Milestones.OrderBy(milestone => milestone.SortOrder))
            .FirstOrDefaultAsync(item => item.Id == id, ct);

        return goal is null ? Results.NotFound() : Results.Ok(ToGoalResponse(goal));
    });

    group.MapPost("/", async (GoalRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Title is required.");
        }

        if (!await db.LifeAreas.AnyAsync(area => area.Id == request.LifeAreaId, ct))
        {
            return Results.BadRequest("Life area does not exist.");
        }

        await EnforcePrimaryGoalLimitAsync(request, db, ct);
        var goal = new Goal();
        Apply(goal, request);
        db.Goals.Add(goal);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/goals/{goal.Id}", ToGoalResponse(goal));
    });

    group.MapPut("/{id:guid}", async (Guid id, GoalRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var goal = await db.Goals.Include(item => item.Milestones).FirstOrDefaultAsync(item => item.Id == id, ct);
        if (goal is null)
        {
            return Results.NotFound();
        }

        await EnforcePrimaryGoalLimitAsync(request, db, ct, id);
        Apply(goal, request);
        if (ShouldPersistCalculatedProgress(goal))
        {
            goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(goal);
        }

        if (goal.Status == GoalStatus.Completed && goal.CompletedAt is null)
        {
            goal.CompletedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(ToGoalResponse(goal));
    });

    group.MapPost("/{id:guid}/recalculate", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var goal = await db.Goals
            .Include(item => item.LifeArea)
            .Include(item => item.Milestones)
            .FirstOrDefaultAsync(item => item.Id == id, ct);

        if (goal is null)
        {
            return Results.NotFound();
        }

        if (ShouldPersistCalculatedProgress(goal))
        {
            goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(goal);
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(ToGoalResponse(goal));
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var goal = await db.Goals.FindAsync([id], ct);
        if (goal is null)
        {
            return Results.NotFound();
        }

        db.Goals.Remove(goal);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });
}

static void MapMilestones(WebApplication app)
{
    app.MapGet("/api/goals/{goalId:guid}/milestones", async (Guid goalId, AxisDbContext db, CancellationToken ct) =>
    {
        var milestones = await db.Milestones
            .Where(milestone => milestone.GoalId == goalId)
            .OrderBy(milestone => milestone.SortOrder)
            .ToListAsync(ct);

        return Results.Ok(milestones.Select(ToMilestoneResponse));
    });

    app.MapPost("/api/goals/{goalId:guid}/milestones", async (Guid goalId, MilestoneRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var goal = await db.Goals.FirstOrDefaultAsync(item => item.Id == goalId, ct);
        if (goal is null)
        {
            return Results.NotFound();
        }

        var milestone = new Milestone { GoalId = goalId };
        Apply(milestone, request);
        db.Milestones.Add(milestone);

        await db.SaveChangesAsync(ct);
        await RecalculateGoalProgressAsync(goalId, db, ct);

        return Results.Created($"/api/milestones/{milestone.Id}", ToMilestoneResponse(milestone));
    });

    app.MapPut("/api/milestones/{id:guid}", async (Guid id, MilestoneRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var milestone = await db.Milestones.Include(item => item.Goal).ThenInclude(goal => goal!.Milestones).FirstOrDefaultAsync(item => item.Id == id, ct);
        if (milestone is null)
        {
            return Results.NotFound();
        }

        Apply(milestone, request);
        if (milestone.CurrentValue >= milestone.TargetValue)
        {
            milestone.Status = MilestoneStatus.Completed;
        }

        if (milestone.Goal is not null)
        {
            if (ShouldPersistCalculatedProgress(milestone.Goal))
            {
                milestone.Goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(milestone.Goal);
            }
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(ToMilestoneResponse(milestone));
    });

    app.MapDelete("/api/milestones/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var milestone = await db.Milestones
            .Include(item => item.Goal)
            .ThenInclude(goal => goal!.Milestones)
            .FirstOrDefaultAsync(item => item.Id == id, ct);
        if (milestone is null)
        {
            return Results.NotFound();
        }

        if (milestone.Goal is not null)
        {
            milestone.Goal.Milestones.Remove(milestone);
            if (ShouldPersistCalculatedProgress(milestone.Goal))
            {
                milestone.Goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(milestone.Goal);
            }
        }

        db.Milestones.Remove(milestone);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    static void Apply(Milestone milestone, MilestoneRequest request)
    {
        milestone.Title = request.Title.Trim();
        milestone.Description = request.Description?.Trim() ?? string.Empty;
        milestone.Type = request.Type;
        milestone.CurrentValue = Math.Max(0, request.CurrentValue);
        milestone.TargetValue = Math.Max(1, request.TargetValue);
        milestone.Unit = request.Unit?.Trim() ?? string.Empty;
        milestone.SortOrder = request.SortOrder;
        milestone.Status = request.Status;
        milestone.DueDate = request.DueDate;
    }
}

static async Task RecalculateGoalProgressAsync(Guid goalId, AxisDbContext db, CancellationToken ct)
{
    var goal = await db.Goals.Include(item => item.Milestones).FirstOrDefaultAsync(item => item.Id == goalId, ct);
    if (goal is null || !ShouldPersistCalculatedProgress(goal))
    {
        return;
    }

    goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(goal);
    await db.SaveChangesAsync(ct);
}

static void MapActivityTemplates(WebApplication app)
{
    var group = app.MapGroup("/api/activity-templates");

    group.MapGet("/", async (AxisDbContext db, CancellationToken ct) =>
    {
        var templates = await db.ActivityTemplates.Include(template => template.LifeArea)
            .OrderByDescending(template => template.IsActive)
            .ThenBy(template => template.Title)
            .Select(template => new
            {
                template.Id,
                template.LifeAreaId,
                LifeAreaName = template.LifeArea == null ? "" : template.LifeArea.Name,
                LifeAreaColor = template.LifeArea == null ? "#4f8cff" : template.LifeArea.Color,
                template.Title,
                template.Description,
                template.DefaultDurationMinutes,
                template.EnergyCost,
                template.MentalLoad,
                template.PhysicalLoad,
                template.DefaultPoints,
                template.IsActive
            })
            .ToListAsync(ct);

        return Results.Ok(templates);
    });

    group.MapPost("/", async (ActivityTemplateRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var template = new ActivityTemplate();
        Apply(template, request);
        db.ActivityTemplates.Add(template);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/activity-templates/{template.Id}", template);
    });

    group.MapPut("/{id:guid}", async (Guid id, ActivityTemplateRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var template = await db.ActivityTemplates.FindAsync([id], ct);
        if (template is null)
        {
            return Results.NotFound();
        }

        Apply(template, request);
        await db.SaveChangesAsync(ct);
        return Results.Ok(template);
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var template = await db.ActivityTemplates.FindAsync([id], ct);
        if (template is null)
        {
            return Results.NotFound();
        }

        db.ActivityTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    static void Apply(ActivityTemplate template, ActivityTemplateRequest request)
    {
        template.LifeAreaId = request.LifeAreaId;
        template.Title = request.Title.Trim();
        template.Description = request.Description?.Trim() ?? string.Empty;
        template.DefaultDurationMinutes = Math.Max(5, request.DefaultDurationMinutes);
        template.EnergyCost = request.EnergyCost;
        template.MentalLoad = request.MentalLoad;
        template.PhysicalLoad = request.PhysicalLoad;
        template.DefaultPoints = Math.Max(0, request.DefaultPoints);
        template.IsActive = request.IsActive;
    }
}

static void MapRecurrenceRules(WebApplication app)
{
    var group = app.MapGroup("/api/recurrence-rules");

    group.MapGet("/", async (Guid? templateId, AxisDbContext db, CancellationToken ct) =>
    {
        var query = db.RecurrenceRules.Include(rule => rule.Template).ThenInclude(template => template!.LifeArea).AsQueryable();
        if (templateId is not null)
        {
            query = query.Where(rule => rule.TemplateId == templateId);
        }

        var rules = await query
            .OrderBy(rule => rule.StartDate)
            .ToListAsync(ct);

        return Results.Ok(rules.Select(ToRecurrenceRuleResponse));
    });

    group.MapPost("/", async (RecurrenceRuleRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        if (!await db.ActivityTemplates.AnyAsync(template => template.Id == request.TemplateId, ct))
        {
            return Results.BadRequest("Template does not exist.");
        }

        var rule = new RecurrenceRule();
        Apply(rule, request);
        db.RecurrenceRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/recurrence-rules/{rule.Id}", ToRecurrenceRuleResponse(rule));
    });

    group.MapPut("/{id:guid}", async (Guid id, RecurrenceRuleRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var rule = await db.RecurrenceRules.FindAsync([id], ct);
        if (rule is null)
        {
            return Results.NotFound();
        }

        Apply(rule, request);
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToRecurrenceRuleResponse(rule));
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var rule = await db.RecurrenceRules.FindAsync([id], ct);
        if (rule is null)
        {
            return Results.NotFound();
        }

        db.RecurrenceRules.Remove(rule);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    group.MapPost("/{id:guid}/generate", async (Guid id, GenerateRecurrenceRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var rule = await db.RecurrenceRules
            .Include(item => item.Template)
            .FirstOrDefaultAsync(item => item.Id == id, ct);

        if (rule?.Template is null)
        {
            return Results.NotFound();
        }

        var start = request.From ?? DateOnly.FromDateTime(DateTimeOffset.Now.DateTime);
        var end = request.To ?? start.AddDays(28);
        if (end < start)
        {
            return Results.BadRequest("End date must be after start date.");
        }

        if (end.DayNumber - start.DayNumber > 180)
        {
            return Results.BadRequest("Recurring generation is limited to 180 days.");
        }

        var plannedDates = ExpandRecurrence(rule, start, end).ToList();
        var existing = await db.Activities
            .Where(activity => activity.TemplateId == rule.TemplateId && activity.PlannedStartAt != null)
            .Select(activity => activity.PlannedStartAt)
            .ToListAsync(ct);
        var existingKeys = existing
            .Where(value => value is not null)
            .Select(value => ToMinuteKey(value!.Value))
            .ToHashSet();
        var created = new List<Activity>();

        foreach (var plannedStart in plannedDates)
        {
            if (existingKeys.Contains(ToMinuteKey(plannedStart)))
            {
                continue;
            }

            var plannedEnd = plannedStart.AddMinutes(rule.Template.DefaultDurationMinutes);
            var activity = new Activity
            {
                LifeAreaId = rule.Template.LifeAreaId,
                TemplateId = rule.TemplateId,
                Title = rule.Template.Title,
                Description = rule.Template.Description,
                PlannedStartAt = plannedStart,
                PlannedEndAt = plannedEnd,
                DurationMinutes = rule.Template.DefaultDurationMinutes,
                Status = ActivityStatus.Planned,
                EnergyCost = rule.Template.EnergyCost,
                MentalLoad = rule.Template.MentalLoad,
                PhysicalLoad = rule.Template.PhysicalLoad,
                Points = rule.Template.DefaultPoints
            };

            db.Activities.Add(activity);
            created.Add(activity);
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { Created = created.Count, Activities = created.Select(ToActivityResponse) });
    });

    static void Apply(RecurrenceRule rule, RecurrenceRuleRequest request)
    {
        rule.TemplateId = request.TemplateId;
        rule.Frequency = request.Frequency;
        rule.Interval = Math.Max(1, request.Interval);
        rule.DaysOfWeek = request.DaysOfWeek?.Trim() ?? string.Empty;
        rule.StartDate = request.StartDate;
        rule.EndDate = request.EndDate;
    }
}

static void MapActivities(WebApplication app)
{
    var group = app.MapGroup("/api/activities");

    group.MapGet("/", async (DateTimeOffset? from, DateTimeOffset? to, ActivityStatus? status, AxisDbContext db, CancellationToken ct) =>
    {
        var query = db.Activities.Include(activity => activity.LifeArea).Include(activity => activity.Goal).AsQueryable();

        if (status is not null)
        {
            query = query.Where(activity => activity.Status == status);
        }

        var activities = (await query.ToListAsync(ct))
            .Where(activity => IsInRange(ActivityDisplayDate(activity), from, to))
            .OrderBy(ActivityDisplayDate)
            .ToList();

        return Results.Ok(activities.Select(ToActivityResponse));
    });

    group.MapPost("/", async (ActivityRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = new Activity();
        Apply(activity, request);
        db.Activities.Add(activity);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/activities/{activity.Id}", ToActivityResponse(activity));
    });

    group.MapPut("/{id:guid}", async (Guid id, ActivityRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = await db.Activities.FindAsync([id], ct);
        if (activity is null)
        {
            return Results.NotFound();
        }

        Apply(activity, request);
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToActivityResponse(activity));
    });

    group.MapPost("/{id:guid}/complete", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = await db.Activities
            .Include(item => item.Milestone)
            .Include(item => item.Goal).ThenInclude(goal => goal!.Milestones)
            .FirstOrDefaultAsync(item => item.Id == id, ct);

        if (activity is null)
        {
            return Results.NotFound();
        }

        if (activity.Status == ActivityStatus.Completed)
        {
            return Results.Ok(ToActivityResponse(activity));
        }

        activity.Status = ActivityStatus.Completed;
        activity.ActualStartAt ??= DateTimeOffset.UtcNow.AddMinutes(-activity.DurationMinutes);
        activity.ActualEndAt ??= DateTimeOffset.UtcNow;

        if (activity.Milestone is not null)
        {
            activity.Milestone.CurrentValue = Math.Min(activity.Milestone.TargetValue, activity.Milestone.CurrentValue + 1);
            if (activity.Milestone.CurrentValue >= activity.Milestone.TargetValue)
            {
                activity.Milestone.Status = MilestoneStatus.Completed;
            }
        }

        if (activity.Goal is not null)
        {
            if (activity.Milestone is null && activity.Goal.ProgressType == ProgressType.CountBased)
            {
                activity.Goal.CurrentValue = Math.Min(activity.Goal.TargetValue, activity.Goal.CurrentValue + 1);
            }
            else if (ShouldPersistCalculatedProgress(activity.Goal))
            {
                activity.Goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(activity.Goal);
            }
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(ToActivityResponse(activity));
    });

    group.MapPost("/{id:guid}/skip", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = await db.Activities.FindAsync([id], ct);
        if (activity is null)
        {
            return Results.NotFound();
        }

        activity.Status = ActivityStatus.Skipped;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToActivityResponse(activity));
    });

    group.MapPost("/{id:guid}/move", async (Guid id, MoveActivityRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = await db.Activities.FindAsync([id], ct);
        if (activity is null)
        {
            return Results.NotFound();
        }

        activity.PlannedStartAt = request.PlannedStartAt;
        activity.PlannedEndAt = request.PlannedEndAt;
        activity.Status = ActivityStatus.Moved;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToActivityResponse(activity));
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var activity = await db.Activities.FindAsync([id], ct);
        if (activity is null)
        {
            return Results.NotFound();
        }

        db.Activities.Remove(activity);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    static void Apply(Activity activity, ActivityRequest request)
    {
        activity.LifeAreaId = request.LifeAreaId;
        activity.GoalId = request.GoalId;
        activity.MilestoneId = request.MilestoneId;
        activity.TemplateId = request.TemplateId;
        activity.Title = request.Title.Trim();
        activity.Description = request.Description?.Trim() ?? string.Empty;
        activity.PlannedStartAt = request.PlannedStartAt;
        activity.PlannedEndAt = request.PlannedEndAt;
        activity.ActualStartAt = request.ActualStartAt;
        activity.ActualEndAt = request.ActualEndAt;
        activity.DurationMinutes = Math.Max(1, request.DurationMinutes);
        activity.Status = request.Status;
        activity.EnergyCost = request.EnergyCost;
        activity.MentalLoad = request.MentalLoad;
        activity.PhysicalLoad = request.PhysicalLoad;
        activity.Points = Math.Max(0, request.Points);
        activity.Notes = request.Notes?.Trim() ?? string.Empty;
    }
}

static void MapMetrics(WebApplication app)
{
    var group = app.MapGroup("/api/metrics");

    group.MapGet("/", async (AxisDbContext db, CancellationToken ct) =>
    {
        var metrics = (await db.Metrics
            .Include(metric => metric.Entries)
            .OrderBy(metric => metric.SortOrder)
            .ThenBy(metric => metric.Name)
            .ToListAsync(ct))
            .Select(metric => new
            {
                metric.Id,
                metric.LifeAreaId,
                metric.GoalId,
                metric.Name,
                metric.Unit,
                metric.ValueType,
                metric.TargetValue,
                metric.SortOrder,
                metric.IsActive,
                LatestEntry = metric.Entries.OrderByDescending(entry => entry.RecordedAt).Select(entry => new { entry.Id, entry.Value, entry.RecordedAt, entry.Notes }).FirstOrDefault()
            })
            .ToList();

        return Results.Ok(metrics);
    });

    group.MapPost("/", async (MetricRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var metric = new Metric();
        Apply(metric, request);
        db.Metrics.Add(metric);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/metrics/{metric.Id}", metric);
    });

    group.MapPut("/{id:guid}", async (Guid id, MetricRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var metric = await db.Metrics.FindAsync([id], ct);
        if (metric is null)
        {
            return Results.NotFound();
        }

        Apply(metric, request);
        await db.SaveChangesAsync(ct);
        return Results.Ok(metric);
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var metric = await db.Metrics.FindAsync([id], ct);
        if (metric is null)
        {
            return Results.NotFound();
        }

        db.Metrics.Remove(metric);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    group.MapPost("/{id:guid}/entries", async (Guid id, MetricEntryRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        if (!await db.Metrics.AnyAsync(metric => metric.Id == id, ct))
        {
            return Results.NotFound();
        }

        var entry = new MetricEntry
        {
            MetricId = id,
            Value = request.Value,
            RecordedAt = request.RecordedAt ?? DateTimeOffset.UtcNow,
            Notes = request.Notes?.Trim() ?? string.Empty
        };

        db.MetricEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/metrics/{id}/entries/{entry.Id}", entry);
    });

    group.MapGet("/{id:guid}/entries", async (Guid id, DateTimeOffset? from, DateTimeOffset? to, AxisDbContext db, CancellationToken ct) =>
    {
        var entries = (await db.MetricEntries
            .Where(entry => entry.MetricId == id)
            .ToListAsync(ct))
            .Where(entry => from is null || entry.RecordedAt >= from)
            .Where(entry => to is null || entry.RecordedAt <= to)
            .OrderByDescending(entry => entry.RecordedAt)
            .ToList();

        return Results.Ok(entries);
    });

    group.MapDelete("/{metricId:guid}/entries/{entryId:guid}", async (Guid metricId, Guid entryId, AxisDbContext db, CancellationToken ct) =>
    {
        var entry = await db.MetricEntries.FirstOrDefaultAsync(item => item.Id == entryId && item.MetricId == metricId, ct);
        if (entry is null)
        {
            return Results.NotFound();
        }

        db.MetricEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });

    static void Apply(Metric metric, MetricRequest request)
    {
        metric.LifeAreaId = request.LifeAreaId;
        metric.GoalId = request.GoalId;
        metric.Name = request.Name.Trim();
        metric.Unit = request.Unit?.Trim() ?? string.Empty;
        metric.ValueType = request.ValueType;
        metric.TargetValue = request.TargetValue;
        metric.SortOrder = request.SortOrder;
        metric.IsActive = request.IsActive;
    }
}

static void MapReviews(WebApplication app)
{
    var group = app.MapGroup("/api/reviews");

    group.MapGet("/", async (AxisDbContext db, CancellationToken ct) =>
    {
        var reviews = await db.Reviews.Include(review => review.Insights)
            .OrderByDescending(review => review.PeriodStart)
            .ToListAsync(ct);

        return Results.Ok(reviews.Select(ToReviewResponse));
    });

    group.MapPost("/weekly/generate", async (DateOnly? weekStart, AxisDbContext db, CancellationToken ct) =>
    {
        var start = weekStart ?? StartOfWeek(DateOnly.FromDateTime(DateTimeOffset.Now.DateTime));
        var end = start.AddDays(6);
        var from = new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), DateTimeOffset.Now.Offset);
        var to = new DateTimeOffset(end.ToDateTime(TimeOnly.MaxValue), DateTimeOffset.Now.Offset);

        var activities = (await db.Activities.Include(activity => activity.LifeArea)
            .ToListAsync(ct))
            .Where(activity => IsInRange(ActivityDisplayDate(activity), from, to))
            .ToList();
        var goals = await db.Goals.Where(goal => goal.Status == GoalStatus.Active).ToListAsync(ct);
        var review = ReviewGenerator.DraftWeeklyReview(start, end, activities, goals);

        db.Reviews.Add(review);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/reviews/{review.Id}", ToReviewResponse(review));
    });

    group.MapPost("/monthly/generate", async (DateOnly? monthStart, AxisDbContext db, CancellationToken ct) =>
    {
        var now = DateTimeOffset.Now;
        var start = monthStart ?? new DateOnly(now.Year, now.Month, 1);
        var end = start.AddMonths(1).AddDays(-1);
        var from = new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), now.Offset);
        var to = new DateTimeOffset(end.ToDateTime(TimeOnly.MaxValue), now.Offset);

        var activities = (await db.Activities.Include(activity => activity.LifeArea)
            .ToListAsync(ct))
            .Where(activity => IsInRange(ActivityDisplayDate(activity), from, to))
            .ToList();
        var goals = await db.Goals
            .Include(goal => goal.Milestones)
            .Where(goal => goal.Status == GoalStatus.Active || goal.Status == GoalStatus.Completed)
            .ToListAsync(ct);
        var metrics = await db.Metrics.AsNoTracking().Include(metric => metric.Entries).ToListAsync(ct);
        foreach (var metric in metrics)
        {
            metric.Entries = metric.Entries
                .Where(entry => entry.RecordedAt >= from && entry.RecordedAt <= to)
                .ToList();
        }

        var review = ReviewGenerator.DraftMonthlyReview(start, end, activities, goals, metrics);

        db.Reviews.Add(review);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/reviews/{review.Id}", ToReviewResponse(review));
    });

    group.MapPut("/{id:guid}", async (Guid id, ReviewRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var review = await db.Reviews.Include(item => item.Insights).FirstOrDefaultAsync(item => item.Id == id, ct);
        if (review is null)
        {
            return Results.NotFound();
        }

        review.Summary = request.Summary?.Trim() ?? review.Summary;
        review.WhatWorked = request.WhatWorked?.Trim() ?? string.Empty;
        review.WhatDidNotWork = request.WhatDidNotWork?.Trim() ?? string.Empty;
        review.NextFocus = request.NextFocus?.Trim() ?? string.Empty;
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToReviewResponse(review));
    });

    group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var review = await db.Reviews.Include(item => item.Insights).FirstOrDefaultAsync(item => item.Id == id, ct);
        if (review is null)
        {
            return Results.NotFound();
        }

        db.Reviews.Remove(review);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    });
}

static object ToReviewResponse(Review review)
{
    return new
    {
        review.Id,
        review.Type,
        review.PeriodStart,
        review.PeriodEnd,
        review.Summary,
        review.WhatWorked,
        review.WhatDidNotWork,
        review.NextFocus,
        review.CreatedAt,
        review.UpdatedAt,
        Insights = review.Insights.Select(insight => new
        {
            insight.Id,
            insight.LifeAreaId,
            insight.GoalId,
            insight.Message,
            insight.Severity,
            insight.CreatedAt,
            insight.UpdatedAt
        })
    };
}

static void MapDashboard(WebApplication app)
{
    var group = app.MapGroup("/api/dashboard");

    group.MapGet("/", async (AxisDbContext db, CancellationToken ct) =>
    {
        var activeGoals = await db.Goals.CountAsync(goal => goal.Status == GoalStatus.Active, ct);
        var recentThreshold = DateTimeOffset.UtcNow.AddDays(-7);
        var completedThisWeek = (await db.Activities
            .Where(activity => activity.Status == ActivityStatus.Completed)
            .ToListAsync(ct))
            .Count(activity => ActivityCompletionDate(activity) >= recentThreshold);
        var primaryGoal = await db.Goals.Include(goal => goal.LifeArea).FirstOrDefaultAsync(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary, ct);

        return Results.Ok(new
        {
            activeGoals,
            completedThisWeek,
            primaryGoal = primaryGoal is null ? null : ToGoalResponse(primaryGoal),
            message = primaryGoal is null ? "Pick one primary goal to orient the week." : $"Main axis: {primaryGoal.Title}"
        });
    });

    group.MapGet("/today", async (AxisDbContext db, CancellationToken ct) =>
    {
        var today = DateOnly.FromDateTime(DateTimeOffset.Now.DateTime);
        var start = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), DateTimeOffset.Now.Offset);
        var end = new DateTimeOffset(today.ToDateTime(TimeOnly.MaxValue), DateTimeOffset.Now.Offset);

        var activities = (await db.Activities.Include(activity => activity.LifeArea).Include(activity => activity.Goal)
            .ToListAsync(ct))
            .Where(activity => IsInRange(ActivityTodayDate(activity), start, end))
            .OrderBy(ActivityTodayDate)
            .ToList();
        var primaryGoal = await db.Goals.Include(goal => goal.LifeArea).FirstOrDefaultAsync(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary, ct);
        var mainFocus = activities.FirstOrDefault(activity => activity.Status == ActivityStatus.Planned && activity.EnergyCost == LoadLevel.High)
            ?? activities.FirstOrDefault(activity => activity.Status == ActivityStatus.Planned);
        var recoveryTask = activities.FirstOrDefault(activity => activity.Status == ActivityStatus.Planned && activity.EnergyCost == LoadLevel.Low);

        return Results.Ok(new
        {
            date = today,
            primaryGoal = primaryGoal is null ? null : ToGoalResponse(primaryGoal),
            mainFocus = mainFocus is null ? null : ToActivityResponse(mainFocus),
            supportTasks = activities.Where(activity => activity.Id != mainFocus?.Id && activity.Id != recoveryTask?.Id).Take(2).Select(ToActivityResponse),
            recoveryTask = recoveryTask is null ? null : ToActivityResponse(recoveryTask),
            timeline = activities.Select(ToActivityResponse),
            suggestion = mainFocus is null
                ? "Keep today light: choose one useful next action."
                : $"Start with {mainFocus.Title}; make it complete, not perfect."
        });
    });

    group.MapGet("/suggestions", async (AxisDbContext db, CancellationToken ct) =>
    {
        var now = DateTimeOffset.Now;
        var today = DateOnly.FromDateTime(now.DateTime);
        var dayStart = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), now.Offset);
        var dayEnd = new DateTimeOffset(today.ToDateTime(TimeOnly.MaxValue), now.Offset);
        var recentThreshold = now.AddDays(-14);
        var activities = await db.Activities.Include(activity => activity.LifeArea).Include(activity => activity.Goal).ToListAsync(ct);
        var goals = await db.Goals.Include(goal => goal.LifeArea).Where(goal => goal.Status == GoalStatus.Active).ToListAsync(ct);
        var areas = await db.LifeAreas.Where(area => area.IsActive).ToListAsync(ct);
        var suggestions = new List<object>();

        var overdue = activities
            .Where(activity => activity.Status == ActivityStatus.Planned && activity.PlannedStartAt is not null && activity.PlannedStartAt < dayStart)
            .OrderBy(activity => activity.PlannedStartAt)
            .FirstOrDefault();
        if (overdue is not null)
        {
            suggestions.Add(new
            {
                Kind = "Overdue",
                Title = $"Decide what to do with {overdue.Title}",
                Reason = "It was planned before today and still has no outcome.",
                Activity = ToActivityResponse(overdue)
            });
        }

        var nextHighValue = activities
            .Where(activity => activity.Status == ActivityStatus.Planned && IsInRange(ActivityTodayDate(activity), dayStart, dayEnd))
            .OrderByDescending(activity => activity.Points)
            .ThenBy(activity => activity.EnergyCost)
            .FirstOrDefault();
        if (nextHighValue is not null)
        {
            suggestions.Add(new
            {
                Kind = "NextAction",
                Title = $"Start {nextHighValue.Title}",
                Reason = "It is planned for today and has the highest point value in the visible plan.",
                Activity = ToActivityResponse(nextHighValue)
            });
        }

        foreach (var area in areas.OrderByDescending(area => area.PriorityWeight).Take(4))
        {
            var lastDone = activities
                .Where(activity => activity.LifeAreaId == area.Id && activity.Status == ActivityStatus.Completed)
                .Select(ActivityCompletionDate)
                .OrderByDescending(date => date)
                .FirstOrDefault();

            if (lastDone == default || lastDone < recentThreshold)
            {
                suggestions.Add(new
                {
                    Kind = "NeglectedArea",
                    Title = $"Give {area.Name} one small action",
                    Reason = lastDone == default ? "No completed activity is recorded for this area yet." : "This area has not had completed attention in the last 14 days.",
                    LifeAreaId = area.Id
                });
            }
        }

        var primaryGoal = goals.FirstOrDefault(goal => goal.Priority == GoalPriority.Primary);
        if (primaryGoal is not null && activities.All(activity => activity.GoalId != primaryGoal.Id || activity.Status != ActivityStatus.Planned))
        {
            suggestions.Add(new
            {
                Kind = "GoalNextStep",
                Title = $"Plan the next step for {primaryGoal.Title}",
                Reason = "Your primary goal has no planned activity right now.",
                Goal = ToGoalResponse(primaryGoal)
            });
        }

        return Results.Ok(suggestions.Take(6));
    });

    group.MapGet("/balance", async (AxisDbContext db, CancellationToken ct) =>
    {
        var since = DateTimeOffset.UtcNow.AddDays(-28);
        var weekStart = StartOfWeek(DateOnly.FromDateTime(DateTimeOffset.Now.DateTime));
        var days = Enumerable.Range(0, 7).Select(offset => weekStart.AddDays(offset)).ToList();
        var lifeAreas = await db.LifeAreas
            .Where(area => area.IsActive)
            .OrderByDescending(area => area.PriorityWeight)
            .ToListAsync(ct);
        var activities = (await db.Activities.Include(activity => activity.LifeArea).ToListAsync(ct))
            .Where(activity => ActivityDisplayDate(activity) >= since || ActivityCompletionDate(activity) >= since)
            .ToList();

        var totalCompletedMinutes = activities
            .Where(activity => activity.Status == ActivityStatus.Completed)
            .Sum(activity => activity.DurationMinutes);
        var totalPriority = lifeAreas.Sum(area => Math.Max(0, area.PriorityWeight));

        return Results.Ok(lifeAreas.Select(area =>
        {
            var areaActivities = activities.Where(activity => activity.LifeAreaId == area.Id).ToList();
            var completed = areaActivities.Where(activity => activity.Status == ActivityStatus.Completed).ToList();
            var skipped = areaActivities.Where(activity => activity.Status == ActivityStatus.Skipped || activity.Status == ActivityStatus.Cancelled).ToList();
            var planned = areaActivities.Where(activity => activity.PlannedStartAt is not null && activity.Status != ActivityStatus.Cancelled).ToList();
            var completedMinutes = completed.Sum(activity => activity.DurationMinutes);
            var plannedMinutes = planned.Sum(activity => activity.DurationMinutes);
            var actualPercent = totalCompletedMinutes == 0 ? 0 : Math.Round(completedMinutes / (decimal)totalCompletedMinutes * 100, 1);
            var targetPercent = totalPriority == 0 ? 0 : Math.Round(Math.Max(0, area.PriorityWeight) / (decimal)totalPriority * 100, 1);
            var gap = Math.Round(actualPercent - targetPercent, 1);

            return new
            {
                LifeAreaId = area.Id,
                area.Name,
                area.Color,
                PriorityWeight = area.PriorityWeight,
                Minutes = completedMinutes,
                Hours = Math.Round(completedMinutes / 60m, 1),
                Count = completed.Count,
                Percent = actualPercent,
                TargetPercent = targetPercent,
                PlannedMinutes = plannedMinutes,
                CompletedMinutes = completedMinutes,
                SkippedMinutes = skipped.Sum(activity => activity.DurationMinutes),
                PlannedCount = planned.Count,
                CompletedCount = completed.Count,
                SkippedCount = skipped.Count,
                AttentionGapPercent = gap,
                Signal = gap < -10 ? "Neglected" : gap > 10 ? "Overloaded" : "Balanced",
                Days = days.Select(day =>
                {
                    var dayStart = new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), DateTimeOffset.Now.Offset);
                    var dayEnd = new DateTimeOffset(day.ToDateTime(TimeOnly.MaxValue), DateTimeOffset.Now.Offset);
                    var dayActivities = areaActivities.Where(activity => IsInRange(ActivityDisplayDate(activity), dayStart, dayEnd)).ToList();
                    var dayCompleted = dayActivities.Where(activity => activity.Status == ActivityStatus.Completed).ToList();

                    return new
                    {
                        Date = day,
                        PlannedMinutes = dayActivities.Where(activity => activity.PlannedStartAt is not null).Sum(activity => activity.DurationMinutes),
                        CompletedMinutes = dayCompleted.Sum(activity => activity.DurationMinutes),
                        SkippedCount = dayActivities.Count(activity => activity.Status == ActivityStatus.Skipped || activity.Status == ActivityStatus.Cancelled)
                    };
                })
            };
        }));
    });

    group.MapGet("/progress", async (AxisDbContext db, CancellationToken ct) =>
    {
        var goals = await db.Goals.Include(goal => goal.LifeArea).Include(goal => goal.Milestones)
            .Where(goal => goal.Status == GoalStatus.Active)
            .OrderBy(goal => goal.Priority)
            .ThenBy(goal => goal.TargetDate)
            .ToListAsync(ct);
        var goalIds = goals.Select(goal => goal.Id).ToHashSet();
        var activities = (await db.Activities
            .Where(activity => activity.GoalId != null && goalIds.Contains(activity.GoalId.Value) && activity.Status == ActivityStatus.Completed)
            .ToListAsync(ct))
            .GroupBy(activity => activity.GoalId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        return Results.Ok(goals.Select(goal => ToGoalProgressResponse(goal, activities.GetValueOrDefault(goal.Id) ?? [])));
    });
}

static void MapBackup(WebApplication app)
{
    var group = app.MapGroup("/api/backup");

    group.MapGet("/status", async (IAxisBackupService backups, CancellationToken ct) => Results.Ok(await backups.GetStatusAsync(ct)));

    group.MapGet("/export", async (IAxisBackupService backups, CancellationToken ct) =>
    {
        var backup = await backups.ExportAsync(ct);
        return Results.File(File.OpenRead(backup.FullPath), "application/zip", backup.FileName);
    });

    group.MapPost("/export", async (IAxisBackupService backups, CancellationToken ct) =>
    {
        var backup = await backups.ExportAsync(ct);
        return Results.File(File.OpenRead(backup.FullPath), "application/zip", backup.FileName);
    });

    group.MapPost("/validate", async (IFormFile file, IAxisBackupService backups, CancellationToken ct) =>
    {
        await using var stream = file.OpenReadStream();
        return Results.Ok(await backups.ValidateAsync(stream, ct));
    }).DisableAntiforgery();

    group.MapPost("/import", async (IFormFile file, IAxisBackupService backups, CancellationToken ct) =>
    {
        await using var stream = file.OpenReadStream();
        var result = await backups.ImportAsync(stream, ct);
        return result.Imported ? Results.Ok(result) : Results.BadRequest(result);
    }).DisableAntiforgery();

    group.MapPost("/restore", async (bool replaceExisting, HttpRequest request, IAxisBackupService backups, CancellationToken ct) =>
    {
        await backups.RestoreAsync(request.Body, replaceExisting, ct);
        return Results.NoContent();
    });
}

static async Task EnforcePrimaryGoalLimitAsync(GoalRequest request, AxisDbContext db, CancellationToken ct, Guid? exceptGoalId = null)
{
    if (request.Status != GoalStatus.Active || request.Priority != GoalPriority.Primary)
    {
        return;
    }

    var existingPrimaryGoals = await db.Goals
        .Where(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary && goal.Id != exceptGoalId)
        .ToListAsync(ct);

    foreach (var goal in existingPrimaryGoals)
    {
        goal.Priority = GoalPriority.Secondary;
    }
}

static void Apply(Goal goal, GoalRequest request)
{
    goal.LifeAreaId = request.LifeAreaId;
    goal.Title = request.Title.Trim();
    goal.Description = request.Description?.Trim() ?? string.Empty;
    goal.Status = request.Status;
    goal.Priority = request.Priority;
    goal.ProgressType = request.ProgressType;
    goal.CurrentValue = Math.Max(0, request.CurrentValue);
    goal.TargetValue = Math.Max(1, request.TargetValue);
    goal.Unit = request.Unit?.Trim() ?? "%";
    goal.TargetDate = request.TargetDate;
    goal.MaintenanceThreshold = Math.Clamp(request.MaintenanceThreshold, 0, 100);
    goal.MaintenanceTargetPerWeek = request.MaintenanceTargetPerWeek;
    goal.DecayRatePercentPerWeek = Math.Max(0, request.DecayRatePercentPerWeek);
}

static bool ShouldPersistCalculatedProgress(Goal goal)
{
    return goal.ProgressType is not (ProgressType.Manual or ProgressType.CountBased or ProgressType.MetricBased);
}

static object ToGoalResponse(Goal goal)
{
    var progress = ProgressCalculator.CalculateGoalProgress(goal);

    return new
    {
        goal.Id,
        goal.LifeAreaId,
        LifeAreaName = goal.LifeArea?.Name ?? "",
        LifeAreaColor = goal.LifeArea?.Color ?? "#4f8cff",
        goal.Title,
        goal.Description,
        goal.Status,
        goal.Priority,
        goal.ProgressType,
        CurrentValue = progress,
        goal.TargetValue,
        goal.Unit,
        goal.TargetDate,
        goal.MaintenanceThreshold,
        goal.MaintenanceTargetPerWeek,
        goal.DecayRatePercentPerWeek,
        Milestones = goal.Milestones.OrderBy(milestone => milestone.SortOrder).Select(ToMilestoneResponse)
    };
}

static object ToGoalProgressResponse(Goal goal, IReadOnlyCollection<Activity> completedActivities)
{
    var baseProgress = ProgressCalculator.CalculateGoalProgress(goal);
    var lastMaintainedAt = completedActivities
        .Select(ActivityCompletionDate)
        .OrderByDescending(date => date)
        .FirstOrDefault();
    DateTimeOffset? maintainedAt = lastMaintainedAt == default ? null : lastMaintainedAt;
    var decayedProgress = goal.ProgressType == ProgressType.Decay
        ? ProgressCalculator.ApplyWeeklyDecay(baseProgress, goal.DecayRatePercentPerWeek, maintainedAt, DateTimeOffset.UtcNow)
        : baseProgress;
    var weekStart = DateTimeOffset.UtcNow.AddDays(-7);
    var completedThisWeek = completedActivities.Count(activity => ActivityCompletionDate(activity) >= weekStart);

    return new
    {
        Goal = ToGoalResponse(goal),
        BaseProgress = baseProgress,
        DecayedProgress = decayedProgress,
        LastMaintainedAt = maintainedAt,
        goal.MaintenanceThreshold,
        goal.MaintenanceTargetPerWeek,
        CompletedThisWeek = completedThisWeek,
        MaintenanceSatisfied = decayedProgress >= goal.MaintenanceThreshold
            && (goal.MaintenanceTargetPerWeek is null || completedThisWeek >= goal.MaintenanceTargetPerWeek)
    };
}

static object ToMilestoneResponse(Milestone milestone)
{
    return new
    {
        milestone.Id,
        milestone.GoalId,
        milestone.Title,
        milestone.Description,
        milestone.Type,
        milestone.CurrentValue,
        milestone.TargetValue,
        milestone.Unit,
        Progress = ProgressCalculator.CalculateRatio(milestone.CurrentValue, milestone.TargetValue),
        milestone.SortOrder,
        milestone.Status,
        milestone.DueDate
    };
}

static object ToRecurrenceRuleResponse(RecurrenceRule rule)
{
    return new
    {
        rule.Id,
        rule.TemplateId,
        TemplateTitle = rule.Template?.Title ?? "",
        LifeAreaName = rule.Template?.LifeArea?.Name ?? "",
        LifeAreaColor = rule.Template?.LifeArea?.Color ?? "#4f8cff",
        rule.Frequency,
        rule.Interval,
        rule.DaysOfWeek,
        rule.StartDate,
        rule.EndDate
    };
}

static object ToActivityResponse(Activity activity)
{
    return new
    {
        activity.Id,
        activity.LifeAreaId,
        LifeAreaName = activity.LifeArea?.Name ?? "",
        LifeAreaColor = activity.LifeArea?.Color ?? "#4f8cff",
        activity.GoalId,
        GoalTitle = activity.Goal?.Title ?? "",
        activity.MilestoneId,
        activity.TemplateId,
        activity.Title,
        activity.Description,
        activity.PlannedStartAt,
        activity.PlannedEndAt,
        activity.ActualStartAt,
        activity.ActualEndAt,
        activity.DurationMinutes,
        activity.Status,
        activity.EnergyCost,
        activity.MentalLoad,
        activity.PhysicalLoad,
        activity.Points,
        activity.Notes
    };
}

static DateOnly StartOfWeek(DateOnly date)
{
    var diff = ((int)date.DayOfWeek + 6) % 7;
    return date.AddDays(-diff);
}

static IEnumerable<DateTimeOffset> ExpandRecurrence(RecurrenceRule rule, DateOnly from, DateOnly to)
{
    var effectiveStart = rule.StartDate > from ? rule.StartDate : from;
    var effectiveEnd = rule.EndDate is not null && rule.EndDate < to ? rule.EndDate.Value : to;
    var time = new TimeOnly(9, 0);
    var offset = DateTimeOffset.Now.Offset;

    for (var day = effectiveStart; day <= effectiveEnd; day = day.AddDays(1))
    {
        if (OccursOn(rule, day))
        {
            yield return new DateTimeOffset(day.ToDateTime(time), offset);
        }
    }
}

static bool OccursOn(RecurrenceRule rule, DateOnly day)
{
    var interval = Math.Max(1, rule.Interval);
    var daysSinceStart = day.DayNumber - rule.StartDate.DayNumber;
    if (daysSinceStart < 0)
    {
        return false;
    }

    return rule.Frequency switch
    {
        RecurrenceFrequency.Daily => daysSinceStart % interval == 0,
        RecurrenceFrequency.Weekly => daysSinceStart / 7 % interval == 0 && ParseDaysOfWeek(rule).Contains(day.DayOfWeek),
        RecurrenceFrequency.Monthly => MonthsBetween(rule.StartDate, day) % interval == 0 && day.Day == rule.StartDate.Day,
        _ => false
    };
}

static HashSet<DayOfWeek> ParseDaysOfWeek(RecurrenceRule rule)
{
    if (string.IsNullOrWhiteSpace(rule.DaysOfWeek))
    {
        return [rule.StartDate.DayOfWeek];
    }

    return rule.DaysOfWeek
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(value => Enum.TryParse<DayOfWeek>(value, true, out var day) ? day : (DayOfWeek?)null)
        .Where(day => day is not null)
        .Select(day => day!.Value)
        .DefaultIfEmpty(rule.StartDate.DayOfWeek)
        .ToHashSet();
}

static int MonthsBetween(DateOnly start, DateOnly day)
{
    return (day.Year - start.Year) * 12 + day.Month - start.Month;
}

static long ToMinuteKey(DateTimeOffset value)
{
    return value.ToUniversalTime().Ticks / TimeSpan.TicksPerMinute;
}

static DateTimeOffset ActivityDisplayDate(Activity activity)
{
    return activity.PlannedStartAt ?? activity.ActualStartAt ?? activity.CreatedAt;
}

static DateTimeOffset ActivityTodayDate(Activity activity)
{
    return activity.PlannedStartAt ?? activity.CreatedAt;
}

static DateTimeOffset ActivityCompletionDate(Activity activity)
{
    return activity.ActualEndAt ?? activity.PlannedEndAt ?? activity.CreatedAt;
}

static bool IsInRange(DateTimeOffset value, DateTimeOffset? from, DateTimeOffset? to)
{
    return (from is null || value >= from.Value) && (to is null || value <= to.Value);
}

public sealed record LifeAreaRequest(string Name, string? Description, string? Color, string? Icon, int PriorityWeight, int CurrentScore, int TargetScore, bool IsActive);

public sealed record GoalRequest(Guid LifeAreaId, string Title, string? Description, GoalStatus Status, GoalPriority Priority, ProgressType ProgressType, decimal CurrentValue, decimal TargetValue, string? Unit, DateOnly? TargetDate, decimal MaintenanceThreshold, int? MaintenanceTargetPerWeek, decimal DecayRatePercentPerWeek);

public sealed record MilestoneRequest(string Title, string? Description, MilestoneType Type, decimal CurrentValue, decimal TargetValue, string? Unit, int SortOrder, MilestoneStatus Status, DateOnly? DueDate);

public sealed record ActivityTemplateRequest(Guid LifeAreaId, string Title, string? Description, int DefaultDurationMinutes, LoadLevel EnergyCost, LoadLevel MentalLoad, LoadLevel PhysicalLoad, int DefaultPoints, bool IsActive);

public sealed record RecurrenceRuleRequest(Guid TemplateId, RecurrenceFrequency Frequency, int Interval, string? DaysOfWeek, DateOnly StartDate, DateOnly? EndDate);

public sealed record GenerateRecurrenceRequest(DateOnly? From, DateOnly? To);

public sealed record ActivityRequest(Guid LifeAreaId, Guid? GoalId, Guid? MilestoneId, Guid? TemplateId, string Title, string? Description, DateTimeOffset? PlannedStartAt, DateTimeOffset? PlannedEndAt, DateTimeOffset? ActualStartAt, DateTimeOffset? ActualEndAt, int DurationMinutes, ActivityStatus Status, LoadLevel EnergyCost, LoadLevel MentalLoad, LoadLevel PhysicalLoad, int Points, string? Notes);

public sealed record MoveActivityRequest(DateTimeOffset PlannedStartAt, DateTimeOffset PlannedEndAt);

public sealed record MetricRequest(Guid? LifeAreaId, Guid? GoalId, string Name, string? Unit, MetricValueType ValueType, decimal? TargetValue, int SortOrder, bool IsActive);

public sealed record MetricEntryRequest(decimal Value, DateTimeOffset? RecordedAt, string? Notes);

public sealed record ReviewRequest(string? Summary, string? WhatWorked, string? WhatDidNotWork, string? NextFocus);
