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
