using Axis.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Axis.Infrastructure.Persistence;

public static class DatabaseStartupExtensions
{
    public static async Task InitializeAxisDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AxisDbContext>();

        await dbContext.Database.EnsureCreatedAsync(cancellationToken);
        await EnsureAxisSchemaAsync(dbContext, cancellationToken);
        await SeedDefaultsAsync(dbContext, cancellationToken);
        await SeedStarterPackAsync(dbContext, cancellationToken);
        await RemoveFlexibleStudyRecurrencesAsync(dbContext, cancellationToken);
        await GenerateRollingRecurringActivitiesAsync(dbContext, 56, cancellationToken);
    }

    private static async Task EnsureAxisSchemaAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Countdowns" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_Countdowns" PRIMARY KEY,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                "Title" TEXT NOT NULL,
                "Description" TEXT NOT NULL,
                "TargetAt" TEXT NOT NULL,
                "Category" TEXT NOT NULL,
                "Color" TEXT NOT NULL,
                "IsPinned" INTEGER NOT NULL,
                "IsArchived" INTEGER NOT NULL
            );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS "IX_Countdowns_TargetAt" ON "Countdowns" ("TargetAt");
            CREATE INDEX IF NOT EXISTS "IX_Countdowns_IsArchived" ON "Countdowns" ("IsArchived");
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "PhysiqueEntries" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_PhysiqueEntries" PRIMARY KEY,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                "RecordedAt" TEXT NOT NULL,
                "Age" INTEGER NOT NULL,
                "Sex" TEXT NOT NULL,
                "HeightCm" TEXT NOT NULL,
                "WeightKg" TEXT NOT NULL,
                "WaistCm" TEXT NULL,
                "NeckCm" TEXT NULL,
                "HipCm" TEXT NULL,
                "BodyFatPercentOverride" TEXT NULL,
                "MuscleMassKg" TEXT NULL,
                "MoodScore" INTEGER NOT NULL,
                "Status" TEXT NOT NULL,
                "Notes" TEXT NOT NULL
            );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS "IX_PhysiqueEntries_RecordedAt" ON "PhysiqueEntries" ("RecordedAt");
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "WikiPages" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_WikiPages" PRIMARY KEY,
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                "Slug" TEXT NOT NULL,
                "Title" TEXT NOT NULL,
                "Category" TEXT NOT NULL,
                "Summary" TEXT NOT NULL,
                "Body" TEXT NOT NULL,
                "Sources" TEXT NOT NULL,
                "SortOrder" INTEGER NOT NULL
            );
            """, cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_WikiPages_Slug" ON "WikiPages" ("Slug");
            CREATE INDEX IF NOT EXISTS "IX_WikiPages_SortOrder" ON "WikiPages" ("SortOrder");
            """, cancellationToken);
    }

    private static async Task SeedDefaultsAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        if (await dbContext.LifeAreas.AnyAsync(cancellationToken))
        {
            return;
        }

        var career = new LifeArea { Name = "Career", Description = "Deep work, interviews, projects, and job progress.", Color = "#3b82f6", Icon = "briefcase", PriorityWeight = 30, TargetScore = 80 };
        var fitness = new LifeArea { Name = "Fitness", Description = "Strength, cardio, body composition, and mobility.", Color = "#16a34a", Icon = "dumbbell", PriorityWeight = 20, TargetScore = 70 };
        var health = new LifeArea { Name = "Health", Description = "Sleep, recovery, stress, and baseline wellbeing.", Color = "#f59e0b", Icon = "heart-pulse", PriorityWeight = 20, TargetScore = 75 };
        var learning = new LifeArea { Name = "Learning", Description = "Courses, reading, deliberate practice, and skill growth.", Color = "#8b5cf6", Icon = "book-open", PriorityWeight = 15, TargetScore = 70 };
        var social = new LifeArea { Name = "Social Life", Description = "Friends, family, community, and relationships.", Color = "#ec4899", Icon = "users", PriorityWeight = 15, TargetScore = 65 };

        dbContext.LifeAreas.AddRange(career, fitness, health, learning, social);
        dbContext.ActivityTemplates.AddRange(
            new ActivityTemplate { LifeArea = career, Title = "Deep work block", Description = "Focused work on the current primary career goal.", DefaultDurationMinutes = 90, EnergyCost = LoadLevel.High, MentalLoad = LoadLevel.High, PhysicalLoad = LoadLevel.Low, DefaultPoints = 12 },
            new ActivityTemplate { LifeArea = fitness, Title = "Gym session", Description = "Strength or conditioning session.", DefaultDurationMinutes = 60, EnergyCost = LoadLevel.High, MentalLoad = LoadLevel.Low, PhysicalLoad = LoadLevel.High, DefaultPoints = 10 },
            new ActivityTemplate { LifeArea = health, Title = "Stretching", Description = "Low-pressure mobility maintenance.", DefaultDurationMinutes = 20, EnergyCost = LoadLevel.Low, MentalLoad = LoadLevel.Low, PhysicalLoad = LoadLevel.Low, DefaultPoints = 5 },
            new ActivityTemplate { LifeArea = social, Title = "Social check-in", Description = "Message, call, or meet someone intentionally.", DefaultDurationMinutes = 30, EnergyCost = LoadLevel.Medium, MentalLoad = LoadLevel.Medium, PhysicalLoad = LoadLevel.Low, DefaultPoints = 6 });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedStarterPackAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        var career = await GetOrCreateAreaAsync(dbContext, "Career", "Deep work, interviews, projects, and job progress.", "#00d5ff", "briefcase", 30, cancellationToken);
        var fitness = await GetOrCreateAreaAsync(dbContext, "Fitness", "Strength, cardio, body composition, muscle gain, leanness, and mobility.", "#66ffd4", "dumbbell", 24, cancellationToken);
        var health = await GetOrCreateAreaAsync(dbContext, "Health", "Sleep, recovery, supplements, alcohol, vaping, and baseline wellbeing.", "#ff4f8b", "heart-pulse", 22, cancellationToken);
        var learning = await GetOrCreateAreaAsync(dbContext, "Learning", "DSA, system design, deliberate practice, and interview skill.", "#d060e8", "book-open", 30, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTimeOffset.Now.DateTime);
        var hasPrimaryGoal = await dbContext.Goals.AnyAsync(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary, cancellationToken);

        var dsaGoal = await EnsureGoalAsync(dbContext, learning, new Goal
        {
            Title = "DSA 250 list x6 repetitions",
            Description = "Finish a 250-problem DSA list six times: first pass for understanding, later passes for speed, recall, and interview fluency.",
            Priority = hasPrimaryGoal ? GoalPriority.Secondary : GoalPriority.Primary,
            ProgressType = ProgressType.MilestoneBased,
            TargetValue = 1500,
            Unit = "problem reps",
            TargetDate = today.AddMonths(9),
            MaintenanceThreshold = 80,
            MaintenanceTargetPerWeek = 5
        }, cancellationToken);

        await EnsureMilestonesAsync(dbContext, dsaGoal, cancellationToken,
            ("Pass 1: understand 250 problems", 0, 250, "problems", 1),
            ("Pass 2: solve again without notes", 0, 250, "problems", 2),
            ("Pass 3: timed reps", 0, 250, "problems", 3),
            ("Pass 4: pattern recall", 0, 250, "problems", 4),
            ("Pass 5: interview speed", 0, 250, "problems", 5),
            ("Pass 6: final retention pass", 0, 250, "problems", 6));

        var systemDesignGoal = await EnsureGoalAsync(dbContext, learning, new Goal
        {
            Title = "System design interview track",
            Description = "Build a repeatable interview toolkit: fundamentals, 30 design cases, trade-off drills, and spoken walkthroughs.",
            Priority = GoalPriority.Secondary,
            ProgressType = ProgressType.MilestoneBased,
            TargetValue = 100,
            Unit = "%",
            TargetDate = today.AddMonths(6),
            MaintenanceThreshold = 75,
            MaintenanceTargetPerWeek = 2
        }, cancellationToken);

        await EnsureMilestonesAsync(dbContext, systemDesignGoal, cancellationToken,
            ("Core fundamentals: capacity, latency, consistency, caching", 0, 1, "track", 1),
            ("30 system design cases", 0, 30, "cases", 2),
            ("10 verbal mock walkthroughs", 0, 10, "mocks", 3));

        var creatineGoal = await EnsureGoalAsync(dbContext, health, new Goal
        {
            Title = "Creatine saturation and maintenance",
            Description = "At 74 kg: optional loading is about 22 g/day split into 4 doses for 5-7 days. Simpler plan: 3-5 g/day, use 5 g here, saturation expected over roughly 3-4 weeks. Missing a day is low impact; long breaks slowly decay stores.",
            Priority = GoalPriority.Maintenance,
            ProgressType = ProgressType.Decay,
            CurrentValue = 0,
            TargetValue = 100,
            Unit = "%",
            MaintenanceThreshold = 85,
            MaintenanceTargetPerWeek = 6,
            DecayRatePercentPerWeek = 12
        }, cancellationToken);

        var mobilityGoal = await EnsureGoalAsync(dbContext, fitness, new Goal
        {
            Title = "Desk mobility and pain-control streak",
            Description = "Daily 10-minute mobility is the default. Minimum useful floor: 2-3 days per week, but desk-work pain usually responds better to small daily sessions.",
            Priority = GoalPriority.Maintenance,
            ProgressType = ProgressType.Maintenance,
            TargetValue = 100,
            Unit = "%",
            MaintenanceThreshold = 80,
            MaintenanceTargetPerWeek = 6,
            DecayRatePercentPerWeek = 8
        }, cancellationToken);

        var hypertrophyGoal = await EnsureGoalAsync(dbContext, fitness, new Goal
        {
            Title = "Lean muscle recomposition",
            Description = "Build muscle while staying lean: train major muscle groups 3-4 days/week, keep protein around 1.6 g/kg/day or more, and track weight, waist, body fat estimate, mood, and consistency.",
            Priority = GoalPriority.Secondary,
            ProgressType = ProgressType.Maintenance,
            TargetValue = 100,
            Unit = "%",
            MaintenanceThreshold = 75,
            MaintenanceTargetPerWeek = 3,
            DecayRatePercentPerWeek = 5
        }, cancellationToken);

        await EnsureGoalAsync(dbContext, health, new Goal
        {
            Title = "Alcohol-free baseline",
            Description = "Track no-alcohol days and drinks. A single planned exception after a long streak is data, not failure; repeated high-frequency drinking should visibly lower the score.",
            Priority = GoalPriority.Maintenance,
            ProgressType = ProgressType.Streak,
            TargetValue = 60,
            Unit = "days",
            MaintenanceThreshold = 80,
            MaintenanceTargetPerWeek = 5,
            DecayRatePercentPerWeek = 18
        }, cancellationToken);

        await EnsureGoalAsync(dbContext, health, new Goal
        {
            Title = "Vape-free baseline",
            Description = "Track vape-free days. Recovery markers improve with time off nicotine; relapse frequency matters more than one isolated slip.",
            Priority = GoalPriority.Maintenance,
            ProgressType = ProgressType.Streak,
            TargetValue = 60,
            Unit = "days",
            MaintenanceThreshold = 80,
            MaintenanceTargetPerWeek = 5,
            DecayRatePercentPerWeek = 18
        }, cancellationToken);

        await EnsureGoalAsync(dbContext, fitness, new Goal
        {
            Title = "Diet adherence for leanness",
            Description = "Daily check-in for protein, calories, vegetables, and alcohol-free choices. Keep it boring enough to repeat.",
            Priority = GoalPriority.Maintenance,
            ProgressType = ProgressType.Maintenance,
            TargetValue = 100,
            Unit = "%",
            MaintenanceThreshold = 80,
            MaintenanceTargetPerWeek = 5,
            DecayRatePercentPerWeek = 10
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var legacyMuscleMetric = await dbContext.Metrics.FirstOrDefaultAsync(item => item.Name == "Muscle mass", cancellationToken);
        var hasLeanMassMetric = await dbContext.Metrics.AnyAsync(item => item.Name == "Lean mass", cancellationToken);
        if (legacyMuscleMetric is not null && !hasLeanMassMetric)
        {
            legacyMuscleMetric.Name = "Lean mass";
        }

        await EnsureMetricAsync(dbContext, fitness, hypertrophyGoal, "Body weight", "kg", MetricValueType.Number, 78, 1, 74, "Initial estimate from profile.", cancellationToken);
        await EnsureMetricAsync(dbContext, fitness, hypertrophyGoal, "Waist circumference", "cm", MetricValueType.Number, null, 2, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, fitness, hypertrophyGoal, "Estimated body fat", "%", MetricValueType.Percentage, 12, 3, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, fitness, hypertrophyGoal, "Lean mass", "kg", MetricValueType.Number, null, 4, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, health, creatineGoal, "Creatine dose", "g", MetricValueType.Number, 5, 5, 5, "Default maintenance dose for 74 kg.", cancellationToken);
        await EnsureMetricAsync(dbContext, health, null, "Alcohol drinks", "drinks", MetricValueType.Number, 0, 6, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, health, null, "Vape-free day", "0/1", MetricValueType.Boolean, 1, 7, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, health, null, "Mood", "1-10", MetricValueType.Rating, null, 8, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, fitness, null, "Protein intake", "g", MetricValueType.Number, 120, 9, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, health, null, "Sleep duration", "h", MetricValueType.Number, 8, 10, null, null, cancellationToken);
        await EnsureMetricAsync(dbContext, health, null, "SPF 30+", "0/1", MetricValueType.Boolean, 1, 11, null, null, cancellationToken);

        if (!await dbContext.PhysiqueEntries.AnyAsync(cancellationToken))
        {
            dbContext.PhysiqueEntries.Add(new PhysiqueEntry
            {
                Age = 27,
                Sex = "Male",
                HeightCm = 175,
                WeightKg = 74,
                MoodScore = 5,
                Status = "Baseline",
                Notes = "Add waist and neck measurements to unlock Navy body-fat estimate."
            });
        }

        await EnsureCountdownAsync(dbContext, new Countdown
        {
            Title = "GTA VI release",
            Description = "Starter countdown using the currently announced Rockstar release date.",
            TargetAt = new DateTimeOffset(2026, 11, 19, 0, 0, 0, TimeSpan.Zero),
            Category = "Games",
            Color = "#ff2fa6",
            IsPinned = true
        }, cancellationToken);

        var creatineTemplate = await EnsureTemplateAsync(dbContext, health, "Creatine dose", "Take 5 g creatine monohydrate and log the metric. Loading option from the wiki: about 22 g/day split across 5-7 days.", 5, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 4, cancellationToken);
        var mobilityTemplate = await EnsureTemplateAsync(dbContext, fitness, "Desk mobility reset", "10 minutes: hip flexors, hamstrings, thoracic extension, pecs/neck, and one pain-free breathing/reset drill.", 10, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 6, cancellationToken);
        var strengthTemplate = await EnsureTemplateAsync(dbContext, fitness, "Hypertrophy workout", "Progressive resistance session. Aim for hard sets, clean reps, and logged progression.", 75, LoadLevel.High, LoadLevel.Medium, LoadLevel.High, 12, cancellationToken);
        var alcoholTemplate = await EnsureTemplateAsync(dbContext, health, "No alcohol check-in", "Log whether today stayed alcohol-free and how many drinks happened if not.", 3, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 5, cancellationToken);
        var vapeTemplate = await EnsureTemplateAsync(dbContext, health, "No vape check-in", "Log vape-free day status and any triggers.", 3, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 5, cancellationToken);
        var dietTemplate = await EnsureTemplateAsync(dbContext, fitness, "Diet check-in", "Protein target, calories, vegetables, and evening cravings check.", 8, LoadLevel.Low, LoadLevel.Medium, LoadLevel.Low, 6, cancellationToken);
        var dsaTemplate = await EnsureTemplateAsync(dbContext, learning, "DSA problem rep", "Solve or review DSA problems from the 250 x6 track.", 75, LoadLevel.High, LoadLevel.High, LoadLevel.Low, 12, cancellationToken);
        var systemTemplate = await EnsureTemplateAsync(dbContext, learning, "System design case study", "Design one system aloud: requirements, scale, API, data model, architecture, bottlenecks, trade-offs.", 90, LoadLevel.High, LoadLevel.High, LoadLevel.Low, 12, cancellationToken);
        var sleepTemplate = await EnsureTemplateAsync(dbContext, health, "Sleep log", "Record the estimated number of hours slept. Axis evaluates the duration against an 8-hour target.", 1, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 4, cancellationToken);
        var spfTemplate = await EnsureTemplateAsync(dbContext, health, "SPF 30+", "Confirm broad-spectrum SPF 30+ use for exposed skin during daylight.", 1, LoadLevel.Low, LoadLevel.Low, LoadLevel.Low, 3, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        await EnsureRecurrenceAsync(dbContext, creatineTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, mobilityTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, strengthTemplate, RecurrenceFrequency.Weekly, 1, "Monday,Wednesday,Friday", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, alcoholTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, vapeTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, dietTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, sleepTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);
        await EnsureRecurrenceAsync(dbContext, spfTemplate, RecurrenceFrequency.Daily, 1, "", today, cancellationToken);

        await EnsureStarterActivitiesAsync(dbContext, today, 28, cancellationToken, creatineTemplate, mobilityTemplate, alcoholTemplate, vapeTemplate, dietTemplate, strengthTemplate, sleepTemplate, spfTemplate);
        await SeedWikiPagesAsync(dbContext, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task<LifeArea> GetOrCreateAreaAsync(AxisDbContext dbContext, string name, string description, string color, string icon, int priorityWeight, CancellationToken cancellationToken)
    {
        var area = await dbContext.LifeAreas.FirstOrDefaultAsync(item => item.Name == name, cancellationToken);
        if (area is not null)
        {
            return area;
        }

        area = new LifeArea
        {
            Name = name,
            Description = description,
            Color = color,
            Icon = icon,
            PriorityWeight = priorityWeight,
            TargetScore = 80,
            IsActive = true
        };
        dbContext.LifeAreas.Add(area);
        return area;
    }

    private static async Task<Goal> EnsureGoalAsync(AxisDbContext dbContext, LifeArea area, Goal goal, CancellationToken cancellationToken)
    {
        var existing = await dbContext.Goals.Include(item => item.Milestones).FirstOrDefaultAsync(item => item.Title == goal.Title, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        goal.LifeAreaId = area.Id;
        dbContext.Goals.Add(goal);
        return goal;
    }

    private static async Task EnsureMilestonesAsync(AxisDbContext dbContext, Goal goal, CancellationToken cancellationToken, params (string Title, decimal Current, decimal Target, string Unit, int Order)[] milestones)
    {
        foreach (var milestone in milestones)
        {
            var exists = await dbContext.Milestones.AnyAsync(item => item.GoalId == goal.Id && item.Title == milestone.Title, cancellationToken);
            if (exists)
            {
                continue;
            }

            dbContext.Milestones.Add(new Milestone
            {
                GoalId = goal.Id,
                Title = milestone.Title,
                Type = MilestoneType.Count,
                CurrentValue = milestone.Current,
                TargetValue = milestone.Target,
                Unit = milestone.Unit,
                SortOrder = milestone.Order,
                Status = MilestoneStatus.Active
            });
        }
    }

    private static async Task<ActivityTemplate> EnsureTemplateAsync(AxisDbContext dbContext, LifeArea area, string title, string description, int minutes, LoadLevel energy, LoadLevel mental, LoadLevel physical, int points, CancellationToken cancellationToken)
    {
        var template = await dbContext.ActivityTemplates.FirstOrDefaultAsync(item => item.Title == title, cancellationToken);
        if (template is not null)
        {
            return template;
        }

        template = new ActivityTemplate
        {
            LifeAreaId = area.Id,
            Title = title,
            Description = description,
            DefaultDurationMinutes = minutes,
            EnergyCost = energy,
            MentalLoad = mental,
            PhysicalLoad = physical,
            DefaultPoints = points,
            IsActive = true
        };
        dbContext.ActivityTemplates.Add(template);
        return template;
    }

    private static async Task EnsureRecurrenceAsync(AxisDbContext dbContext, ActivityTemplate template, RecurrenceFrequency frequency, int interval, string daysOfWeek, DateOnly startDate, CancellationToken cancellationToken)
    {
        var exists = await dbContext.RecurrenceRules.AnyAsync(item => item.TemplateId == template.Id && item.Frequency == frequency && item.DaysOfWeek == daysOfWeek, cancellationToken);
        if (exists)
        {
            return;
        }

        dbContext.RecurrenceRules.Add(new RecurrenceRule
        {
            TemplateId = template.Id,
            Frequency = frequency,
            Interval = interval,
            DaysOfWeek = daysOfWeek,
            StartDate = startDate
        });
    }

    private static async Task EnsureStarterActivitiesAsync(AxisDbContext dbContext, DateOnly startDate, int days, CancellationToken cancellationToken, params ActivityTemplate[] templates)
    {
        var offset = DateTimeOffset.Now.Offset;
        var hourMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Creatine dose"] = 8,
            ["Desk mobility reset"] = 11,
            ["No alcohol check-in"] = 20,
            ["No vape check-in"] = 20,
            ["Diet check-in"] = 21,
            ["DSA problem rep"] = 18,
            ["System design case study"] = 19,
            ["Hypertrophy workout"] = 17,
            ["Sleep log"] = 8,
            ["SPF 30+"] = 8
        };

        for (var offsetDays = 0; offsetDays < days; offsetDays++)
        {
            var date = startDate.AddDays(offsetDays);
            foreach (var template in templates)
            {
                if (template.Title == "Hypertrophy workout" && date.DayOfWeek is not (DayOfWeek.Monday or DayOfWeek.Wednesday or DayOfWeek.Friday))
                {
                    continue;
                }

                if (template.Title == "System design case study" && date.DayOfWeek is not (DayOfWeek.Tuesday or DayOfWeek.Thursday or DayOfWeek.Saturday))
                {
                    continue;
                }

                var hour = hourMap.GetValueOrDefault(template.Title, 9);
                var plannedStart = new DateTimeOffset(date.ToDateTime(new TimeOnly(hour, 0)), offset);
                var exists = await dbContext.Activities.AnyAsync(item => item.TemplateId == template.Id && item.PlannedStartAt == plannedStart, cancellationToken);
                if (exists)
                {
                    continue;
                }

                dbContext.Activities.Add(new Activity
                {
                    LifeAreaId = template.LifeAreaId,
                    TemplateId = template.Id,
                    Title = template.Title,
                    Description = template.Description,
                    PlannedStartAt = plannedStart,
                    PlannedEndAt = plannedStart.AddMinutes(template.DefaultDurationMinutes),
                    DurationMinutes = template.DefaultDurationMinutes,
                    Status = ActivityStatus.Planned,
                    EnergyCost = template.EnergyCost,
                    MentalLoad = template.MentalLoad,
                    PhysicalLoad = template.PhysicalLoad,
                    Points = template.DefaultPoints
                });
            }
        }
    }

    private static async Task GenerateRollingRecurringActivitiesAsync(AxisDbContext dbContext, int horizonDays, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTimeOffset.Now.DateTime);
        var endDate = today.AddDays(Math.Max(1, horizonDays));
        var rules = await dbContext.RecurrenceRules
            .Include(rule => rule.Template)
            .Where(rule => rule.Template != null && rule.Template.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var rule in rules)
        {
            if (rule.Template is null)
            {
                continue;
            }

            var plannedDates = ExpandRecurrence(rule, today, endDate, GetDefaultHour(rule.Template)).ToList();
            if (plannedDates.Count == 0)
            {
                continue;
            }

            var existing = await dbContext.Activities
                .Where(activity => activity.TemplateId == rule.TemplateId && activity.PlannedStartAt != null)
                .Select(activity => activity.PlannedStartAt)
                .ToListAsync(cancellationToken);
            var existingKeys = existing
                .Where(value => value is not null)
                .Select(value => ToMinuteKey(value!.Value))
                .ToHashSet();

            foreach (var plannedStart in plannedDates)
            {
                if (existingKeys.Contains(ToMinuteKey(plannedStart)))
                {
                    continue;
                }

                dbContext.Activities.Add(new Activity
                {
                    LifeAreaId = rule.Template.LifeAreaId,
                    TemplateId = rule.TemplateId,
                    Title = rule.Template.Title,
                    Description = rule.Template.Description,
                    PlannedStartAt = plannedStart,
                    PlannedEndAt = plannedStart.AddMinutes(rule.Template.DefaultDurationMinutes),
                    DurationMinutes = rule.Template.DefaultDurationMinutes,
                    Status = ActivityStatus.Planned,
                    EnergyCost = rule.Template.EnergyCost,
                    MentalLoad = rule.Template.MentalLoad,
                    PhysicalLoad = rule.Template.PhysicalLoad,
                    Points = rule.Template.DefaultPoints
                });
                existingKeys.Add(ToMinuteKey(plannedStart));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task RemoveFlexibleStudyRecurrencesAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        var flexibleTemplates = await dbContext.ActivityTemplates
            .Where(template => template.Title == "DSA problem rep" || template.Title == "System design case study")
            .ToListAsync(cancellationToken);
        if (flexibleTemplates.Count == 0)
        {
            return;
        }

        var templateIds = flexibleTemplates.Select(template => template.Id).ToList();
        var rules = await dbContext.RecurrenceRules
            .Where(rule => templateIds.Contains(rule.TemplateId))
            .ToListAsync(cancellationToken);
        dbContext.RecurrenceRules.RemoveRange(rules);

        var now = DateTimeOffset.Now;
        var plannedStudyActivities = await dbContext.Activities
            .Where(activity =>
                activity.Status == ActivityStatus.Planned
                && (activity.Title == "DSA problem rep" || activity.Title == "System design case study"))
            .ToListAsync(cancellationToken);
        var futureGeneratedPlans = plannedStudyActivities
            .Where(activity =>
                activity.TemplateId is not null
                && templateIds.Contains(activity.TemplateId.Value)
                && (activity.PlannedStartAt is null || activity.PlannedStartAt >= now))
            .ToList();
        dbContext.Activities.RemoveRange(futureGeneratedPlans);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static IEnumerable<DateTimeOffset> ExpandRecurrence(RecurrenceRule rule, DateOnly from, DateOnly to, int hour)
    {
        var effectiveStart = rule.StartDate > from ? rule.StartDate : from;
        var effectiveEnd = rule.EndDate is not null && rule.EndDate < to ? rule.EndDate.Value : to;
        var time = new TimeOnly(Math.Clamp(hour, 0, 23), 0);
        var offset = DateTimeOffset.Now.Offset;

        for (var day = effectiveStart; day <= effectiveEnd; day = day.AddDays(1))
        {
            if (OccursOn(rule, day))
            {
                yield return new DateTimeOffset(day.ToDateTime(time), offset);
            }
        }
    }

    private static bool OccursOn(RecurrenceRule rule, DateOnly day)
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

    private static HashSet<DayOfWeek> ParseDaysOfWeek(RecurrenceRule rule)
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

    private static int MonthsBetween(DateOnly start, DateOnly day)
    {
        return (day.Year - start.Year) * 12 + day.Month - start.Month;
    }

    private static long ToMinuteKey(DateTimeOffset value)
    {
        return value.ToUniversalTime().Ticks / TimeSpan.TicksPerMinute;
    }

    private static int GetDefaultHour(ActivityTemplate template)
    {
        return template.Title switch
        {
            "Creatine dose" => 8,
            "Desk mobility reset" => 11,
            "Hypertrophy workout" => 17,
            "DSA problem rep" => 18,
            "System design case study" => 19,
            "No alcohol check-in" => 20,
            "No vape check-in" => 20,
            "Diet check-in" => 21,
            _ => 9
        };
    }

    private static async Task EnsureMetricAsync(AxisDbContext dbContext, LifeArea area, Goal? goal, string name, string unit, MetricValueType valueType, decimal? targetValue, int sortOrder, decimal? initialValue, string? initialNote, CancellationToken cancellationToken)
    {
        var metric = await dbContext.Metrics.FirstOrDefaultAsync(item => item.Name == name, cancellationToken);
        if (metric is null)
        {
            metric = new Metric
            {
                LifeAreaId = area.Id,
                GoalId = goal?.Id,
                Name = name,
                Unit = unit,
                ValueType = valueType,
                TargetValue = targetValue,
                SortOrder = sortOrder,
                IsActive = true
            };
            dbContext.Metrics.Add(metric);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (initialValue is not null && !await dbContext.MetricEntries.AnyAsync(entry => entry.MetricId == metric.Id, cancellationToken))
        {
            dbContext.MetricEntries.Add(new MetricEntry
            {
                MetricId = metric.Id,
                Value = initialValue.Value,
                Notes = initialNote ?? string.Empty
            });
        }
    }

    private static async Task EnsureCountdownAsync(AxisDbContext dbContext, Countdown countdown, CancellationToken cancellationToken)
    {
        if (await dbContext.Countdowns.AnyAsync(item => item.Title == countdown.Title, cancellationToken))
        {
            return;
        }

        dbContext.Countdowns.Add(countdown);
    }

    private static async Task SeedWikiPagesAsync(AxisDbContext dbContext, CancellationToken cancellationToken)
    {
        await EnsureWikiPageAsync(dbContext, "axis-start-here", "Start here: the simple Axis workflow", "Getting started", "Use four screens for almost everything: Today, Signals, Physique, and Goals.", """
            Start with Today when you want to see what is planned. Use Signals when you want the fastest workflow: choose a time range, scan the momentum graph and activity rows, then use Log now only after the confirmation appears. If a quick log was wrong, remove it under Recent quick logs.

            Use Physique when you have new measurements. Enter weight, waist, neck, and hip circumference; Axis calculates body-fat estimate, fat mass, lean mass, BMI, and FFMI. You do not need to calculate these yourself. Mood, status, and notes are optional context.

            Open Goals when you want the bigger picture. Click a goal card to see progress, recent history, linked metrics, and milestones. DSA and system design are flexible: log them when you actually study instead of treating every empty day as failure.

            The rest is optional power: Calendar is for planning exact times, Metrics is for detailed numeric history, Reviews is for reflection, and Backup protects the local database. You do not need those screens for a normal daily check-in.
            """, "", 0, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "creatine-saturation", "Creatine saturation", "Health", "Use a daily creatine marker to build and preserve saturation.", """
            For your estimated 74 kg body weight, the aggressive loading option is about 22 g/day for 5-7 days, split into smaller doses. The simpler option is 3-5 g/day; Axis seeds 5 g/day because it is easy to remember and inside the common maintenance range.

            How to use Axis: complete the daily Creatine dose activity and log the Creatine dose metric. Missing 1-2 days after you are saturated should barely matter. Longer breaks should slowly show up through the decay goal; the default decay is intentionally gentle week to week, then visible across a month.
            """, "ISSN creatine position stand: https://pmc.ncbi.nlm.nih.gov/articles/PMC5469049/", 1, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "mobility-desk-pain", "Mobility for desk-work pain", "Fitness", "Small daily sessions beat heroic occasional stretching.", """
            Axis seeds a 10-minute daily Desk mobility reset. Focus on pain-free ranges: hip flexors, hamstrings, thoracic extension, pecs, neck, and breathing. The minimum evidence-based floor for flexibility is 2-3 days/week, but daily work is usually more practical for desk stiffness.

            How to use Axis: mark the mobility activity done every day. If pain spikes, write it in notes instead of forcing intensity. A skipped day is not a disaster; repeated misses lower the maintenance score.
            """, "ACSM flexibility guidance summary: https://pmc.ncbi.nlm.nih.gov/articles/PMC13006343/", 2, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "hypertrophy-lean", "Hypertrophy and leanness", "Fitness", "Lift hard, keep protein high, and measure waist plus body weight.", """
            The seeded plan uses three hypertrophy workouts per week. For muscle growth, progressive resistance training matters most. A useful protein target for you is around 120 g/day at 74 kg using the 1.6 g/kg/day evidence threshold; higher can be useful during calorie deficits.

            How to use Axis: log Body weight, Waist circumference, Estimated body fat, Protein intake, Mood, and workouts. The Physique page estimates body fat when you add waist and neck measurements, then derives fat mass and lean mass from weight.
            """, "ACSM resistance training overview: https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/ | Protein meta-analysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC5867436/", 3, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "alcohol-vape-recovery", "Alcohol and vape recovery", "Health", "Track abstinent days, not moral failure.", """
            Axis seeds no-alcohol and no-vape check-ins. If you usually drink a few beers daily, the first goal is visibility: how many drinks, which triggers, and how many alcohol-free days. For vaping, track vape-free days and triggers. One isolated slip after a long streak is not the same as returning to daily use; repeated slips should show up in the streak and decay signals.

            How to use Axis: each evening complete the check-ins, log Alcohol drinks, and log Vape-free day as 1 or 0. Reviews should look for patterns: weekends, stress, late nights, boredom, social settings.
            """, "CDC alcohol health: https://www.cdc.gov/alcohol/about-alcohol-use/index.html | WHO alcohol and cancer: https://www.who.int/europe/news/item/04-01-2023-no-level-of-alcohol-consumption-is-safe-for-our-health | CDC quitting smoking benefits: https://www.cdc.gov/tobacco/about/benefits-of-quitting.html", 4, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "diet-recomposition", "Diet for recomposition", "Fitness", "Protein, calories, adherence, and alcohol reduction drive the body-comp trend.", """
            The Diet check-in is a daily guardrail: protein, calories, vegetables, and evening cravings. For a lean muscular look, the app should help you see whether body weight, waist, mood, and training are moving together.

            How to use Axis: log Protein intake and Body weight often enough to see the weekly trend. If weight rises and waist rises quickly, adjust calories. If strength and mood crash, recovery or calories may be too low.
            """, "ISSN protein position stand: https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/ | CDC healthy weight and activity: https://www.cdc.gov/healthy-weight-growth/physical-activity/", 5, cancellationToken);

        await EnsureWikiPageAsync(dbContext, "dsa-system-design", "DSA and system design track", "Learning", "The job-search priority is daily reps plus system design cases.", """
            DSA is seeded as 250 problems x6 repetitions: 1500 total problem-reps. Treat every pass differently: understanding, independent solve, timed solve, pattern recall, speed, final retention. System design is seeded as fundamentals plus 30 cases and 10 spoken mocks.

            How to use Axis: complete the daily DSA activity, update the current pass milestone, and use weekly/monthly reviews to see whether the primary goal is actually getting time.
            """, "Physical Activity Guidelines are unrelated here; this page is a workflow recipe built from your stated goal.", 6, cancellationToken);
    }

    private static async Task EnsureWikiPageAsync(AxisDbContext dbContext, string slug, string title, string category, string summary, string body, string sources, int sortOrder, CancellationToken cancellationToken)
    {
        if (await dbContext.WikiPages.AnyAsync(item => item.Slug == slug, cancellationToken))
        {
            return;
        }

        dbContext.WikiPages.Add(new WikiPage
        {
            Slug = slug,
            Title = title,
            Category = category,
            Summary = summary,
            Body = body.Trim(),
            Sources = sources,
            SortOrder = sortOrder
        });
    }
}
