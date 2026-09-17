namespace Axis.Domain;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LifeArea : Entity
{
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Color { get; set; } = "#4f8cff";

    public string Icon { get; set; } = "circle";

    public int PriorityWeight { get; set; } = 10;

    public int CurrentScore { get; set; }

    public int TargetScore { get; set; } = 70;

    public bool IsActive { get; set; } = true;

    public List<Goal> Goals { get; set; } = [];

    public List<Activity> Activities { get; set; } = [];
}

public sealed class Goal : Entity
{
    public Guid LifeAreaId { get; set; }

    public LifeArea? LifeArea { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public GoalStatus Status { get; set; } = GoalStatus.Active;

    public GoalPriority Priority { get; set; } = GoalPriority.Secondary;

    public ProgressType ProgressType { get; set; } = ProgressType.MilestoneBased;

    public decimal CurrentValue { get; set; }

    public decimal TargetValue { get; set; } = 100;

    public string Unit { get; set; } = "%";

    public DateOnly? TargetDate { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public decimal MaintenanceThreshold { get; set; } = 80;

    public int? MaintenanceTargetPerWeek { get; set; }

    public decimal DecayRatePercentPerWeek { get; set; }

    public List<Milestone> Milestones { get; set; } = [];

    public List<Activity> Activities { get; set; } = [];
}

public sealed class Milestone : Entity
{
    public Guid GoalId { get; set; }

    public Goal? Goal { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public MilestoneType Type { get; set; } = MilestoneType.Count;

    public decimal CurrentValue { get; set; }

    public decimal TargetValue { get; set; } = 1;

    public string Unit { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public MilestoneStatus Status { get; set; } = MilestoneStatus.Active;

    public DateOnly? DueDate { get; set; }
}

public sealed class ActivityTemplate : Entity
{
    public Guid LifeAreaId { get; set; }

    public LifeArea? LifeArea { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public int DefaultDurationMinutes { get; set; } = 30;

    public LoadLevel EnergyCost { get; set; } = LoadLevel.Medium;

    public LoadLevel MentalLoad { get; set; } = LoadLevel.Medium;

    public LoadLevel PhysicalLoad { get; set; } = LoadLevel.Low;

    public int DefaultPoints { get; set; } = 5;

    public bool IsActive { get; set; } = true;
}

public sealed class Activity : Entity
{
    public Guid LifeAreaId { get; set; }

    public LifeArea? LifeArea { get; set; }

    public Guid? GoalId { get; set; }

    public Goal? Goal { get; set; }

    public Guid? MilestoneId { get; set; }

    public Milestone? Milestone { get; set; }

    public Guid? TemplateId { get; set; }

    public ActivityTemplate? Template { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTimeOffset? PlannedStartAt { get; set; }

    public DateTimeOffset? PlannedEndAt { get; set; }

    public DateTimeOffset? ActualStartAt { get; set; }

    public DateTimeOffset? ActualEndAt { get; set; }

    public int DurationMinutes { get; set; } = 30;

    public ActivityStatus Status { get; set; } = ActivityStatus.Planned;

    public LoadLevel EnergyCost { get; set; } = LoadLevel.Medium;

    public LoadLevel MentalLoad { get; set; } = LoadLevel.Medium;

    public LoadLevel PhysicalLoad { get; set; } = LoadLevel.Low;

    public int Points { get; set; } = 5;

    public string Notes { get; set; } = string.Empty;
}

public sealed class Metric : Entity
{
    public Guid? LifeAreaId { get; set; }

    public LifeArea? LifeArea { get; set; }

    public Guid? GoalId { get; set; }

    public Goal? Goal { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Unit { get; set; } = string.Empty;

    public MetricValueType ValueType { get; set; } = MetricValueType.Number;

    public decimal? TargetValue { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public List<MetricEntry> Entries { get; set; } = [];
}

public sealed class MetricEntry : Entity
{
    public Guid MetricId { get; set; }

    public Metric? Metric { get; set; }

    public decimal Value { get; set; }

    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public string Notes { get; set; } = string.Empty;
}

public sealed class Countdown : Entity
{
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTimeOffset TargetAt { get; set; }

    public string Category { get; set; } = string.Empty;

    public string Color { get; set; } = "#d060e8";

    public bool IsPinned { get; set; } = true;

    public bool IsArchived { get; set; }
}

public sealed class PhysiqueEntry : Entity
{
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public int Age { get; set; } = 27;

    public string Sex { get; set; } = "Male";

    public decimal HeightCm { get; set; } = 175;

    public decimal WeightKg { get; set; } = 74;

    public decimal? WaistCm { get; set; }

    public decimal? NeckCm { get; set; }

    public decimal? HipCm { get; set; }

    public decimal? BodyFatPercentOverride { get; set; }

    public decimal? MuscleMassKg { get; set; }

    public int MoodScore { get; set; } = 5;

    public string Status { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;
}

public sealed class MoodEntry : Entity
{
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    public int Score { get; set; } = 5;
    public int Energy { get; set; } = 5;
    public int Stress { get; set; } = 5;
    public string Context { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public sealed class DiaryEntry : Entity
{
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
}

public sealed class LifeLesson : Entity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
}

public sealed class SavingsEntry : Entity
{
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;
    public decimal Amount { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class WishlistItem : Entity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Priority { get; set; } = 3;
    public bool IsPurchased { get; set; }
    public DateTimeOffset? PurchasedAt { get; set; }
}

public sealed class WikiPage : Entity
{
    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Sources { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}

public sealed class Review : Entity
{
    public ReviewType Type { get; set; } = ReviewType.Weekly;

    public DateOnly PeriodStart { get; set; }

    public DateOnly PeriodEnd { get; set; }

    public string Summary { get; set; } = string.Empty;

    public string WhatWorked { get; set; } = string.Empty;

    public string WhatDidNotWork { get; set; } = string.Empty;

    public string NextFocus { get; set; } = string.Empty;

    public List<ReviewInsight> Insights { get; set; } = [];
}

public sealed class ReviewInsight : Entity
{
    public Guid ReviewId { get; set; }

    public Review? Review { get; set; }

    public Guid? LifeAreaId { get; set; }

    public LifeArea? LifeArea { get; set; }

    public Guid? GoalId { get; set; }

    public Goal? Goal { get; set; }

    public string Message { get; set; } = string.Empty;

    public InsightSeverity Severity { get; set; } = InsightSeverity.Info;
}

public sealed class RecurrenceRule : Entity
{
    public Guid TemplateId { get; set; }

    public ActivityTemplate? Template { get; set; }

    public RecurrenceFrequency Frequency { get; set; } = RecurrenceFrequency.Weekly;

    public int Interval { get; set; } = 1;

    public string DaysOfWeek { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }
}

public enum GoalStatus
{
    Active,
    Paused,
    Completed,
    Archived
}

public enum GoalPriority
{
    Primary,
    Secondary,
    Maintenance
}

public enum ProgressType
{
    Manual,
    MilestoneBased,
    CountBased,
    MetricBased,
    Decay,
    Streak,
    Maintenance
}

public enum MilestoneType
{
    Count,
    Repetition,
    Binary,
    Metric,
    Checklist
}

public enum MilestoneStatus
{
    Active,
    Completed,
    Paused,
    Archived
}

public enum ActivityStatus
{
    Planned,
    Completed,
    Skipped,
    Moved,
    Cancelled
}

public enum LoadLevel
{
    Low,
    Medium,
    High
}

public enum MetricValueType
{
    Number,
    Percentage,
    Duration,
    Currency,
    Rating,
    Boolean
}

public enum ReviewType
{
    Weekly,
    Monthly
}

public enum InsightSeverity
{
    Info,
    Success,
    Warning,
    Critical
}

public enum RecurrenceFrequency
{
    Daily,
    Weekly,
    Monthly
}
