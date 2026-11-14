using Axis.Domain;

namespace Axis.Api.Contracts;

public sealed record LifeAreaRequest(
    string Name,
    string? Description,
    string? Color,
    string? Icon,
    int PriorityWeight,
    int CurrentScore,
    int TargetScore,
    bool IsActive);

public sealed record GoalRequest(
    Guid LifeAreaId,
    string Title,
    string? Description,
    GoalStatus Status,
    GoalPriority Priority,
    ProgressType ProgressType,
    decimal CurrentValue,
    decimal TargetValue,
    string? Unit,
    DateOnly? TargetDate,
    decimal MaintenanceThreshold,
    int? MaintenanceTargetPerWeek,
    decimal DecayRatePercentPerWeek);

public sealed record MilestoneRequest(
    string Title,
    string? Description,
    MilestoneType Type,
    decimal CurrentValue,
    decimal TargetValue,
    string? Unit,
    int SortOrder,
    MilestoneStatus Status,
    DateOnly? DueDate);

public sealed record ActivityTemplateRequest(
    Guid LifeAreaId,
    Guid? GoalId,
    string Title,
    string? Description,
    int DefaultDurationMinutes,
    LoadLevel EnergyCost,
    LoadLevel MentalLoad,
    LoadLevel PhysicalLoad,
    int DefaultPoints,
    bool IsActive);

public sealed record RecurrenceRuleRequest(
    Guid TemplateId,
    RecurrenceFrequency Frequency,
    int Interval,
    string? DaysOfWeek,
    DateOnly StartDate,
    DateOnly? EndDate);

public sealed record GenerateRecurrenceRequest(DateOnly? From, DateOnly? To);

public sealed record ActivityRequest(
    Guid LifeAreaId,
    Guid? GoalId,
    Guid? MilestoneId,
    Guid? TemplateId,
    string Title,
    string? Description,
    DateTimeOffset? PlannedStartAt,
    DateTimeOffset? PlannedEndAt,
    DateTimeOffset? ActualStartAt,
    DateTimeOffset? ActualEndAt,
    int DurationMinutes,
    ActivityStatus Status,
    LoadLevel EnergyCost,
    LoadLevel MentalLoad,
    LoadLevel PhysicalLoad,
    int Points,
    string? Notes);

public sealed record MoveActivityRequest(DateTimeOffset PlannedStartAt, DateTimeOffset PlannedEndAt);

public sealed record MetricRequest(
    Guid? LifeAreaId,
    Guid? GoalId,
    string Name,
    string? Unit,
    MetricValueType ValueType,
    decimal? TargetValue,
    int SortOrder,
    bool IsActive);

public sealed record MetricEntryRequest(decimal Value, DateTimeOffset? RecordedAt, string? Notes);

public sealed record DailyMeasurementsRequest(
    DateOnly RecordedOn,
    decimal? Steps,
    decimal? WaterMl,
    decimal? Calories,
    decimal? Protein,
    decimal? Carbohydrates,
    decimal? Fat,
    decimal? Fiber,
    string? Notes);

public sealed record CountdownRequest(
    string Title,
    string? Description,
    DateTimeOffset TargetAt,
    string? Category,
    string? Color,
    bool IsPinned,
    bool IsArchived);

public sealed record PhysiqueEntryRequest(
    DateTimeOffset? RecordedAt,
    int Age,
    string? Sex,
    decimal HeightCm,
    decimal WeightKg,
    decimal? WaistCm,
    decimal? NeckCm,
    decimal? HipCm,
    decimal? BodyFatPercentOverride,
    decimal? MuscleMassKg,
    int MoodScore,
    string? Status,
    string? Notes);

public sealed record MoodEntryRequest(
    DateTimeOffset? RecordedAt,
    int Score,
    int Energy,
    int Stress,
    string? Context,
    string? Notes);

public sealed record DiaryEntryRequest(DateTimeOffset? OccurredAt, string Title, string? Body, string? Tags);

public sealed record LifeLessonRequest(string Title, string Content, string? Category, string? Source, bool IsPinned);

public sealed record FocusNoteRequest(
    string? Title,
    string? Content,
    string? Label,
    string? Color,
    bool IsPinned,
    bool IsArchived);

public sealed record CompanyRequest(
    string Name,
    string? Website,
    string? CareersUrl,
    string? Industry,
    string? CompanySize,
    string? Headquarters,
    string? Description,
    string? TechStack,
    string? VisaSponsorship,
    string? VisaNotes,
    bool RelocationSupport,
    string? Notes,
    bool IsArchived,
    bool JobOffersChecked = false,
    int MyFitRating = 5,
    IReadOnlyList<CompanyLocationRequest>? Locations = null,
    DateTimeOffset? JobOffersCheckedAt = null,
    string? Tier = null,
    string? TargetRole = null,
    string? ScoutingStatus = null,
    string? MainGap = null,
    string? CompensationNotes = null,
    string? StrategicValue = null,
    string? UsaOpportunity = null);

public sealed record CompanyLocationRequest(
    string Name,
    string? City,
    string? Region,
    string? Country,
    string? Address,
    string? CareersUrl,
    string? VisaSponsorship,
    string? Notes,
    bool IsActive);

public sealed record JobApplicationRequest(
    string CompanyName,
    string PositionTitle,
    JobApplicationStatus Status,
    JobWorkMode WorkMode,
    string? EmploymentType,
    string? Location,
    string? Country,
    decimal? SalaryMin,
    decimal? SalaryMax,
    string? Currency,
    int DesireRating,
    int FitRating,
    int Priority,
    string? CompanyUrl,
    string? PostingUrl,
    string? ApplicationUrl,
    string? Source,
    string? ContactName,
    string? ContactEmail,
    string? JobDescription,
    string? Notes,
    DateTimeOffset DiscoveredAt,
    DateTimeOffset? AppliedAt,
    DateTimeOffset? LastContactAt,
    DateTimeOffset? FollowUpAt,
    DateTimeOffset? DeadlineAt,
    DateTimeOffset? DecisionAt,
    bool IsArchived,
    Guid? CompanyId = null,
    Guid? CompanyLocationId = null,
    string? RoleRequirements = null,
    string? PreparationTopics = null);

public sealed record JobStageRequest(
    string Title,
    JobStageStatus Status,
    string? Focus,
    string? Notes,
    DateTimeOffset? ScheduledAt,
    DateTimeOffset? CompletedAt,
    int? SortOrder);

public sealed record JobPreparationItemRequest(
    string Title,
    string? Notes,
    bool IsCompleted,
    DateTimeOffset? CompletedAt,
    int? SortOrder);

public sealed record SavingsEntryRequest(decimal Amount, string? Note);

public sealed record WishlistItemRequest(
    string Name,
    string? Description,
    decimal Price,
    int Priority,
    bool IsPurchased);

public sealed record RoadmapRequest(
    string Title,
    string? Description,
    string? Color,
    string? LayoutDirection,
    bool IsArchived);

public sealed record RoadmapItemRequest(
    Guid? GoalId,
    string Title,
    string? Description,
    RoadmapItemStatus Status,
    DateOnly? TargetDate,
    int? SortOrder,
    IReadOnlyList<Guid>? DependencyIds);

public sealed record RoadmapItemMoveRequest(int Direction);

public sealed record ReviewRequest(
    string? Summary,
    string? WhatWorked,
    string? WhatDidNotWork,
    string? NextFocus);
