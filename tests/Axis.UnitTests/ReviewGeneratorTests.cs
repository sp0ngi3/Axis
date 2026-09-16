using Axis.Application.Reviews;
using Axis.Domain;

namespace Axis.UnitTests;

public sealed class ReviewGeneratorTests
{
    [Fact]
    public void DraftMonthlyReview_SummarizesCompletedActivitiesAndMilestones()
    {
        var periodStart = new DateOnly(2026, 9, 1);
        var periodEnd = new DateOnly(2026, 9, 30);
        var activities = new[]
        {
            new Activity { Status = ActivityStatus.Completed, DurationMinutes = 90 },
            new Activity { Status = ActivityStatus.Skipped, DurationMinutes = 30 }
        };
        var goals = new[]
        {
            new Goal
            {
                Status = GoalStatus.Active,
                Priority = GoalPriority.Primary,
                Title = "Career",
                CurrentValue = 40,
                TargetValue = 100,
                Milestones = [new Milestone { Status = MilestoneStatus.Completed }]
            }
        };
        var metrics = new[]
        {
            new Metric { Entries = [new MetricEntry { Value = 8 }] }
        };

        var review = ReviewGenerator.DraftMonthlyReview(periodStart, periodEnd, activities, goals, metrics);

        Assert.Equal(ReviewType.Monthly, review.Type);
        Assert.Contains("Completed 1 activities", review.Summary);
        Assert.Contains("finished 1 milestones", review.Summary);
        Assert.Contains("Career", review.NextFocus);
        Assert.Contains(review.Insights, insight => insight.Severity == InsightSeverity.Success);
    }

    [Fact]
    public void DraftMonthlyReview_WarnsAboutStalledGoals()
    {
        var goal = new Goal
        {
            Status = GoalStatus.Active,
            Title = "Fitness",
            CurrentValue = 5,
            TargetValue = 100
        };

        var review = ReviewGenerator.DraftMonthlyReview(
            new DateOnly(2026, 9, 1),
            new DateOnly(2026, 9, 30),
            [],
            [goal],
            []);

        Assert.Contains(review.Insights, insight => insight.Severity == InsightSeverity.Warning && insight.Message.Contains("Fitness"));
    }
}
