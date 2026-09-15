using System.Text.Json.Serialization;
using Axis.Application.Backup;
using Axis.Application.Progress;
using Axis.Application.Reviews;
using Axis.Domain;
using Axis.Infrastructure;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

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
        var goal = await db.Goals.Include(item => item.Milestones).FirstOrDefaultAsync(item => item.Id == goalId, ct);
        if (goal is null)
        {
            return Results.NotFound();
        }

        var milestone = new Milestone { GoalId = goalId };
        Apply(milestone, request);
        goal.Milestones.Add(milestone);
        if (ShouldPersistCalculatedProgress(goal))
        {
            goal.CurrentValue = ProgressCalculator.CalculateGoalProgress(goal);
        }

        await db.SaveChangesAsync(ct);

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

    group.MapGet("/{id:guid}/entries", async (Guid id, AxisDbContext db, CancellationToken ct) =>
    {
        var entries = (await db.MetricEntries
            .Where(entry => entry.MetricId == id)
            .ToListAsync(ct))
            .OrderByDescending(entry => entry.RecordedAt)
            .ToList();

        return Results.Ok(entries);
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

        return Results.Ok(reviews);
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

        return Results.Created($"/api/reviews/{review.Id}", review);
    });

    group.MapPut("/{id:guid}", async (Guid id, ReviewRequest request, AxisDbContext db, CancellationToken ct) =>
    {
        var review = await db.Reviews.FindAsync([id], ct);
        if (review is null)
        {
            return Results.NotFound();
        }

        review.Summary = request.Summary?.Trim() ?? review.Summary;
        review.WhatWorked = request.WhatWorked?.Trim() ?? string.Empty;
        review.WhatDidNotWork = request.WhatDidNotWork?.Trim() ?? string.Empty;
        review.NextFocus = request.NextFocus?.Trim() ?? string.Empty;
        await db.SaveChangesAsync(ct);
        return Results.Ok(review);
    });
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

    group.MapGet("/balance", async (AxisDbContext db, CancellationToken ct) =>
    {
        var since = DateTimeOffset.UtcNow.AddDays(-28);
        var rows = (await db.Activities.Include(activity => activity.LifeArea)
            .Where(activity => activity.Status == ActivityStatus.Completed)
            .ToListAsync(ct))
            .Where(activity => ActivityCompletionDate(activity) >= since)
            .GroupBy(activity => new { activity.LifeAreaId, activity.LifeArea!.Name, activity.LifeArea.Color })
            .Select(grouping => new
            {
                grouping.Key.LifeAreaId,
                grouping.Key.Name,
                grouping.Key.Color,
                Minutes = grouping.Sum(activity => activity.DurationMinutes),
                Count = grouping.Count()
            })
            .OrderByDescending(row => row.Minutes)
            .ToList();

        var total = rows.Sum(row => row.Minutes);
        return Results.Ok(rows.Select(row => new
        {
            row.LifeAreaId,
            row.Name,
            row.Color,
            row.Minutes,
            Hours = Math.Round(row.Minutes / 60m, 1),
            row.Count,
            Percent = total == 0 ? 0 : Math.Round(row.Minutes / (decimal)total * 100, 1)
        }));
    });

    group.MapGet("/progress", async (AxisDbContext db, CancellationToken ct) =>
    {
        var goals = await db.Goals.Include(goal => goal.LifeArea).Include(goal => goal.Milestones)
            .Where(goal => goal.Status == GoalStatus.Active)
            .OrderBy(goal => goal.Priority)
            .ThenBy(goal => goal.TargetDate)
            .ToListAsync(ct);

        return Results.Ok(goals.Select(ToGoalResponse));
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

public sealed record ActivityRequest(Guid LifeAreaId, Guid? GoalId, Guid? MilestoneId, Guid? TemplateId, string Title, string? Description, DateTimeOffset? PlannedStartAt, DateTimeOffset? PlannedEndAt, DateTimeOffset? ActualStartAt, DateTimeOffset? ActualEndAt, int DurationMinutes, ActivityStatus Status, LoadLevel EnergyCost, LoadLevel MentalLoad, LoadLevel PhysicalLoad, int Points, string? Notes);

public sealed record MoveActivityRequest(DateTimeOffset PlannedStartAt, DateTimeOffset PlannedEndAt);

public sealed record MetricRequest(Guid? LifeAreaId, Guid? GoalId, string Name, string? Unit, MetricValueType ValueType, decimal? TargetValue, int SortOrder, bool IsActive);

public sealed record MetricEntryRequest(decimal Value, DateTimeOffset? RecordedAt, string? Notes);

public sealed record ReviewRequest(string? Summary, string? WhatWorked, string? WhatDidNotWork, string? NextFocus);
