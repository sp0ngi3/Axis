using Axis.Domain;
using Microsoft.EntityFrameworkCore;

namespace Axis.Infrastructure.Persistence;

public sealed class AxisDbContext(DbContextOptions<AxisDbContext> options) : DbContext(options)
{
    public DbSet<LifeArea> LifeAreas => Set<LifeArea>();

    public DbSet<Goal> Goals => Set<Goal>();

    public DbSet<Milestone> Milestones => Set<Milestone>();

    public DbSet<ActivityTemplate> ActivityTemplates => Set<ActivityTemplate>();

    public DbSet<Activity> Activities => Set<Activity>();

    public DbSet<Metric> Metrics => Set<Metric>();

    public DbSet<MetricEntry> MetricEntries => Set<MetricEntry>();

    public DbSet<Countdown> Countdowns => Set<Countdown>();

    public DbSet<PhysiqueEntry> PhysiqueEntries => Set<PhysiqueEntry>();

    public DbSet<MoodEntry> MoodEntries => Set<MoodEntry>();

    public DbSet<DiaryEntry> DiaryEntries => Set<DiaryEntry>();

    public DbSet<LifeLesson> LifeLessons => Set<LifeLesson>();

    public DbSet<FocusNote> FocusNotes => Set<FocusNote>();

    public DbSet<Company> Companies => Set<Company>();

    public DbSet<CompanyLocation> CompanyLocations => Set<CompanyLocation>();

    public DbSet<JobApplication> JobApplications => Set<JobApplication>();

    public DbSet<JobApplicationStage> JobApplicationStages => Set<JobApplicationStage>();

    public DbSet<JobPreparationItem> JobPreparationItems => Set<JobPreparationItem>();

    public DbSet<SavingsEntry> SavingsEntries => Set<SavingsEntry>();

    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();

    public DbSet<Roadmap> Roadmaps => Set<Roadmap>();

    public DbSet<RoadmapItem> RoadmapItems => Set<RoadmapItem>();

    public DbSet<RoadmapConnection> RoadmapConnections => Set<RoadmapConnection>();

    public DbSet<WikiPage> WikiPages => Set<WikiPage>();

    public DbSet<Review> Reviews => Set<Review>();

    public DbSet<ReviewInsight> ReviewInsights => Set<ReviewInsight>();

    public DbSet<RecurrenceRule> RecurrenceRules => Set<RecurrenceRule>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampEntities();
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureLifeAreas(modelBuilder);
        ConfigureGoals(modelBuilder);
        ConfigureMilestones(modelBuilder);
        ConfigureActivityTemplates(modelBuilder);
        ConfigureActivities(modelBuilder);
        ConfigureMetrics(modelBuilder);
        ConfigureCountdowns(modelBuilder);
        ConfigurePhysiqueEntries(modelBuilder);
        ConfigureMoodEntries(modelBuilder);
        ConfigureDiaryEntries(modelBuilder);
        ConfigureLifeLessons(modelBuilder);
        ConfigureFocusNotes(modelBuilder);
        ConfigureJobApplications(modelBuilder);
        ConfigureMoney(modelBuilder);
        ConfigureRoadmaps(modelBuilder);
        ConfigureWikiPages(modelBuilder);
        ConfigureReviews(modelBuilder);
        ConfigureRecurrenceRules(modelBuilder);
    }

    private void StampEntities()
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }

    private static void ConfigureLifeAreas(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LifeArea>(entity =>
        {
            entity.Property(area => area.Name).HasMaxLength(120).IsRequired();
            entity.Property(area => area.Description).HasMaxLength(1000);
            entity.Property(area => area.Color).HasMaxLength(24).IsRequired();
            entity.Property(area => area.Icon).HasMaxLength(80).IsRequired();
            entity.HasIndex(area => area.Name).IsUnique();
        });
    }

    private static void ConfigureGoals(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Goal>(entity =>
        {
            entity.Property(goal => goal.Title).HasMaxLength(200).IsRequired();
            entity.Property(goal => goal.Description).HasMaxLength(2000);
            entity.Property(goal => goal.Unit).HasMaxLength(40);
            entity.Property(goal => goal.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(goal => goal.Priority).HasConversion<string>().HasMaxLength(40);
            entity.Property(goal => goal.ProgressType).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(goal => goal.Status);
            entity.HasIndex(goal => goal.LifeAreaId);
        });
    }

    private static void ConfigureMilestones(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Milestone>(entity =>
        {
            entity.Property(milestone => milestone.Title).HasMaxLength(200).IsRequired();
            entity.Property(milestone => milestone.Description).HasMaxLength(2000);
            entity.Property(milestone => milestone.Unit).HasMaxLength(40);
            entity.Property(milestone => milestone.Type).HasConversion<string>().HasMaxLength(40);
            entity.Property(milestone => milestone.Status).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(milestone => milestone.GoalId);
        });
    }

    private static void ConfigureActivityTemplates(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ActivityTemplate>(entity =>
        {
            entity.Property(template => template.Title).HasMaxLength(200).IsRequired();
            entity.Property(template => template.Description).HasMaxLength(1000);
            entity.Property(template => template.EnergyCost).HasConversion<string>().HasMaxLength(40);
            entity.Property(template => template.MentalLoad).HasConversion<string>().HasMaxLength(40);
            entity.Property(template => template.PhysicalLoad).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(template => template.LifeAreaId);
            entity.HasIndex(template => template.GoalId);
        });
    }

    private static void ConfigureActivities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Activity>(entity =>
        {
            entity.Property(activity => activity.Title).HasMaxLength(200).IsRequired();
            entity.Property(activity => activity.Description).HasMaxLength(1000);
            entity.Property(activity => activity.Notes).HasMaxLength(4000);
            entity.Property(activity => activity.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(activity => activity.EnergyCost).HasConversion<string>().HasMaxLength(40);
            entity.Property(activity => activity.MentalLoad).HasConversion<string>().HasMaxLength(40);
            entity.Property(activity => activity.PhysicalLoad).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(activity => activity.PlannedStartAt);
            entity.HasIndex(activity => activity.ActualStartAt);
            entity.HasIndex(activity => activity.Status);
            entity.HasIndex(activity => activity.LifeAreaId);
            entity.HasIndex(activity => activity.GoalId);
            entity.HasOne(activity => activity.Milestone).WithMany().HasForeignKey(activity => activity.MilestoneId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(activity => activity.Template).WithMany().HasForeignKey(activity => activity.TemplateId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureMetrics(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Metric>(entity =>
        {
            entity.Property(metric => metric.Name).HasMaxLength(160).IsRequired();
            entity.Property(metric => metric.Unit).HasMaxLength(40);
            entity.Property(metric => metric.ValueType).HasConversion<string>().HasMaxLength(40);
        });

        modelBuilder.Entity<MetricEntry>(entity =>
        {
            entity.Property(entry => entry.Notes).HasMaxLength(1000);
            entity.HasIndex(entry => new { entry.MetricId, entry.RecordedAt });
        });
    }

    private static void ConfigureCountdowns(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Countdown>(entity =>
        {
            entity.Property(countdown => countdown.Title).HasMaxLength(200).IsRequired();
            entity.Property(countdown => countdown.Description).HasMaxLength(2000);
            entity.Property(countdown => countdown.Category).HasMaxLength(80);
            entity.Property(countdown => countdown.Color).HasMaxLength(24).IsRequired();
            entity.HasIndex(countdown => countdown.TargetAt);
            entity.HasIndex(countdown => countdown.IsArchived);
        });
    }

    private static void ConfigurePhysiqueEntries(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PhysiqueEntry>(entity =>
        {
            entity.Property(entry => entry.Sex).HasMaxLength(24).IsRequired();
            entity.Property(entry => entry.Status).HasMaxLength(160);
            entity.Property(entry => entry.Notes).HasMaxLength(2000);
            entity.HasIndex(entry => entry.RecordedAt);
        });
    }

    private static void ConfigureMoodEntries(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MoodEntry>(entity =>
        {
            entity.Property(entry => entry.Context).HasMaxLength(500);
            entity.Property(entry => entry.Notes).HasMaxLength(4000);
            entity.HasIndex(entry => entry.RecordedAt);
        });
    }

    private static void ConfigureDiaryEntries(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DiaryEntry>(entity =>
        {
            entity.Property(entry => entry.Title).HasMaxLength(200).IsRequired();
            entity.Property(entry => entry.Body).HasMaxLength(12000);
            entity.Property(entry => entry.Tags).HasMaxLength(500);
            entity.HasIndex(entry => entry.OccurredAt);
        });
    }

    private static void ConfigureLifeLessons(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LifeLesson>(entity =>
        {
            entity.Property(item => item.Title).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Content).HasMaxLength(8000).IsRequired();
            entity.Property(item => item.Category).HasMaxLength(100);
            entity.Property(item => item.Source).HasMaxLength(500);
            entity.HasIndex(item => item.IsPinned);
        });
    }

    private static void ConfigureFocusNotes(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FocusNote>(entity =>
        {
            entity.Property(item => item.Title).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Content).HasMaxLength(8000).IsRequired();
            entity.Property(item => item.Label).HasMaxLength(80);
            entity.Property(item => item.Color).HasMaxLength(24).IsRequired();
            entity.HasIndex(item => item.IsPinned);
            entity.HasIndex(item => item.IsArchived);
            entity.HasIndex(item => item.UpdatedAt);
        });
    }

    private static void ConfigureMoney(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SavingsEntry>(entity =>
        {
            entity.Property(item => item.Note).HasMaxLength(500);
            entity.HasIndex(item => item.RecordedAt);
        });
        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.Property(item => item.Name).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Description).HasMaxLength(2000);
            entity.HasIndex(item => item.IsPurchased);
            entity.HasIndex(item => item.Priority);
        });
    }

    private static void ConfigureRoadmaps(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Roadmap>(entity =>
        {
            entity.Property(roadmap => roadmap.Title).HasMaxLength(200).IsRequired();
            entity.Property(roadmap => roadmap.Description).HasMaxLength(4000);
            entity.Property(roadmap => roadmap.Color).HasMaxLength(24).IsRequired();
            entity.Property(roadmap => roadmap.LayoutDirection).HasMaxLength(24).IsRequired();
            entity.HasIndex(roadmap => roadmap.IsArchived);
            entity.HasIndex(roadmap => roadmap.UpdatedAt);
        });

        modelBuilder.Entity<RoadmapItem>(entity =>
        {
            entity.Property(item => item.Title).HasMaxLength(240).IsRequired();
            entity.Property(item => item.Description).HasMaxLength(4000);
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(40);
            entity.HasIndex(item => new { item.RoadmapId, item.SortOrder });
            entity.HasIndex(item => item.GoalId);
            entity.HasOne(item => item.Roadmap)
                .WithMany(roadmap => roadmap.Items)
                .HasForeignKey(item => item.RoadmapId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Goal)
                .WithMany()
                .HasForeignKey(item => item.GoalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RoadmapConnection>(entity =>
        {
            entity.HasIndex(connection => new { connection.SourceItemId, connection.TargetItemId }).IsUnique();
            entity.HasIndex(connection => connection.RoadmapId);
            entity.HasOne(connection => connection.Roadmap)
                .WithMany(roadmap => roadmap.Connections)
                .HasForeignKey(connection => connection.RoadmapId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RoadmapItem>()
                .WithMany()
                .HasForeignKey(connection => connection.SourceItemId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<RoadmapItem>()
                .WithMany()
                .HasForeignKey(connection => connection.TargetItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureJobApplications(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(entity =>
        {
            entity.Property(item => item.Name).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Website).HasMaxLength(1000);
            entity.Property(item => item.CareersUrl).HasMaxLength(1000);
            entity.Property(item => item.Industry).HasMaxLength(160);
            entity.Property(item => item.CompanySize).HasMaxLength(80);
            entity.Property(item => item.Headquarters).HasMaxLength(200);
            entity.Property(item => item.Description).HasMaxLength(6000);
            entity.Property(item => item.TechStack).HasMaxLength(2000);
            entity.Property(item => item.VisaSponsorship).HasMaxLength(40);
            entity.Property(item => item.VisaNotes).HasMaxLength(3000);
            entity.Property(item => item.Tier).HasMaxLength(8);
            entity.Property(item => item.TargetRole).HasMaxLength(200);
            entity.Property(item => item.ScoutingStatus).HasMaxLength(40);
            entity.Property(item => item.MainGap).HasMaxLength(2000);
            entity.Property(item => item.CompensationNotes).HasMaxLength(3000);
            entity.Property(item => item.StrategicValue).HasMaxLength(40);
            entity.Property(item => item.UsaOpportunity).HasMaxLength(2000);
            entity.Property(item => item.Notes).HasMaxLength(6000);
            entity.HasIndex(item => item.Name);
            entity.HasIndex(item => item.IsArchived);
            entity.HasIndex(item => item.JobOffersChecked);
            entity.HasIndex(item => item.MyFitRating);
            entity.HasIndex(item => item.Tier);
            entity.HasIndex(item => item.ScoutingStatus);
        });

        modelBuilder.Entity<CompanyLocation>(entity =>
        {
            entity.Property(item => item.Name).HasMaxLength(200).IsRequired();
            entity.Property(item => item.City).HasMaxLength(160);
            entity.Property(item => item.Region).HasMaxLength(160);
            entity.Property(item => item.Country).HasMaxLength(120);
            entity.Property(item => item.Address).HasMaxLength(500);
            entity.Property(item => item.CareersUrl).HasMaxLength(1000);
            entity.Property(item => item.VisaSponsorship).HasMaxLength(40);
            entity.Property(item => item.Notes).HasMaxLength(3000);
            entity.HasIndex(item => new { item.CompanyId, item.City, item.Country });
            entity.HasIndex(item => item.IsActive);
            entity.HasOne(item => item.Company)
                .WithMany(item => item.Locations)
                .HasForeignKey(item => item.CompanyId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobApplication>(entity =>
        {
            entity.Property(item => item.CompanyName).HasMaxLength(200).IsRequired();
            entity.Property(item => item.PositionTitle).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.WorkMode).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.EmploymentType).HasMaxLength(80);
            entity.Property(item => item.Location).HasMaxLength(200);
            entity.Property(item => item.Country).HasMaxLength(120);
            entity.Property(item => item.Currency).HasMaxLength(8);
            entity.Property(item => item.CompanyUrl).HasMaxLength(1000);
            entity.Property(item => item.PostingUrl).HasMaxLength(1000);
            entity.Property(item => item.ApplicationUrl).HasMaxLength(1000);
            entity.Property(item => item.Source).HasMaxLength(200);
            entity.Property(item => item.ContactName).HasMaxLength(200);
            entity.Property(item => item.ContactEmail).HasMaxLength(320);
            entity.Property(item => item.JobDescription).HasMaxLength(12000);
            entity.Property(item => item.RoleRequirements).HasMaxLength(8000);
            entity.Property(item => item.PreparationTopics).HasMaxLength(4000);
            entity.Property(item => item.Notes).HasMaxLength(8000);
            entity.HasIndex(item => item.CompanyId);
            entity.HasIndex(item => item.CompanyLocationId);
            entity.HasIndex(item => item.Status);
            entity.HasIndex(item => item.Location);
            entity.HasIndex(item => item.DiscoveredAt);
            entity.HasIndex(item => item.FollowUpAt);
            entity.HasIndex(item => item.IsArchived);
        });

        modelBuilder.Entity<JobApplicationStage>(entity =>
        {
            entity.Property(item => item.Title).HasMaxLength(200).IsRequired();
            entity.Property(item => item.Status).HasConversion<string>().HasMaxLength(40);
            entity.Property(item => item.Focus).HasMaxLength(4000);
            entity.Property(item => item.Notes).HasMaxLength(4000);
            entity.HasIndex(item => new { item.JobApplicationId, item.SortOrder });
            entity.HasOne(item => item.JobApplication)
                .WithMany(item => item.Stages)
                .HasForeignKey(item => item.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobPreparationItem>(entity =>
        {
            entity.Property(item => item.Title).HasMaxLength(500).IsRequired();
            entity.Property(item => item.Notes).HasMaxLength(2000);
            entity.HasIndex(item => new { item.JobApplicationStageId, item.SortOrder });
            entity.HasOne(item => item.JobApplicationStage)
                .WithMany(item => item.Checklist)
                .HasForeignKey(item => item.JobApplicationStageId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureWikiPages(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WikiPage>(entity =>
        {
            entity.Property(page => page.Slug).HasMaxLength(120).IsRequired();
            entity.Property(page => page.Title).HasMaxLength(200).IsRequired();
            entity.Property(page => page.Category).HasMaxLength(80);
            entity.Property(page => page.Summary).HasMaxLength(1000);
            entity.Property(page => page.Body).HasMaxLength(8000);
            entity.Property(page => page.Sources).HasMaxLength(4000);
            entity.HasIndex(page => page.Slug).IsUnique();
            entity.HasIndex(page => page.SortOrder);
        });
    }

    private static void ConfigureReviews(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Review>(entity =>
        {
            entity.Property(review => review.Type).HasConversion<string>().HasMaxLength(40);
            entity.Property(review => review.Summary).HasMaxLength(4000);
            entity.Property(review => review.WhatWorked).HasMaxLength(4000);
            entity.Property(review => review.WhatDidNotWork).HasMaxLength(4000);
            entity.Property(review => review.NextFocus).HasMaxLength(4000);
            entity.HasIndex(review => new { review.PeriodStart, review.PeriodEnd });
        });

        modelBuilder.Entity<ReviewInsight>(entity =>
        {
            entity.Property(insight => insight.Message).HasMaxLength(2000).IsRequired();
            entity.Property(insight => insight.Severity).HasConversion<string>().HasMaxLength(40);
        });
    }

    private static void ConfigureRecurrenceRules(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RecurrenceRule>(entity =>
        {
            entity.Property(rule => rule.Frequency).HasConversion<string>().HasMaxLength(40);
            entity.Property(rule => rule.DaysOfWeek).HasMaxLength(80);
        });
    }
}
