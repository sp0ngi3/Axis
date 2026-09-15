using Axis.Domain;

namespace Axis.Application.Reviews;

public static class ReviewGenerator
{
    public static Review DraftWeeklyReview(DateOnly periodStart, DateOnly periodEnd, IReadOnlyCollection<Activity> activities, IReadOnlyCollection<Goal> goals)
    {
        var planned = activities.Count(activity => activity.PlannedStartAt is not null);
        var completed = activities.Count(activity => activity.Status == ActivityStatus.Completed);
        var skipped = activities.Count(activity => activity.Status == ActivityStatus.Skipped);
        var completedMinutes = activities
            .Where(activity => activity.Status == ActivityStatus.Completed)
            .Sum(activity => Math.Max(0, activity.DurationMinutes));

        var primaryGoal = goals.FirstOrDefault(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary)
            ?? goals.FirstOrDefault(goal => goal.Status == GoalStatus.Active);

        var review = new Review
        {
            Type = ReviewType.Weekly,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Summary = $"Planned {planned} activities, completed {completed}, skipped {skipped}, and logged {completedMinutes / 60m:0.#}h of real attention.",
            NextFocus = primaryGoal is null
                ? "Choose one primary goal for next week."
                : $"Keep the main focus on {primaryGoal.Title}."
        };

        if (planned > 0 && completed == 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = "Nothing planned was completed. Make next week lighter and easier to start.",
                Severity = InsightSeverity.Warning
            });
        }

        if (skipped > completed && skipped > 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = "More activities were skipped than completed. Reduce pressure or move some goals into maintenance.",
                Severity = InsightSeverity.Warning
            });
        }

        if (completed > 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = "Progress was made. Keep the next step specific and realistic.",
                Severity = InsightSeverity.Success
            });
        }

        return review;
    }

    public static Review DraftMonthlyReview(DateOnly periodStart, DateOnly periodEnd, IReadOnlyCollection<Activity> activities, IReadOnlyCollection<Goal> goals, IReadOnlyCollection<Metric> metrics)
    {
        var completed = activities.Count(activity => activity.Status == ActivityStatus.Completed);
        var skipped = activities.Count(activity => activity.Status == ActivityStatus.Skipped);
        var completedMinutes = activities
            .Where(activity => activity.Status == ActivityStatus.Completed)
            .Sum(activity => Math.Max(0, activity.DurationMinutes));
        var completedMilestones = goals
            .SelectMany(goal => goal.Milestones)
            .Count(milestone => milestone.Status == MilestoneStatus.Completed);
        var stalledGoals = goals
            .Where(goal => goal.Status == GoalStatus.Active && CalculateGoalProgress(goal) < 15)
            .Take(3)
            .ToList();
        var primaryGoal = goals.FirstOrDefault(goal => goal.Status == GoalStatus.Active && goal.Priority == GoalPriority.Primary)
            ?? goals.FirstOrDefault(goal => goal.Status == GoalStatus.Active);
        var metricsWithEntries = metrics.Count(metric => metric.Entries.Count > 0);

        var review = new Review
        {
            Type = ReviewType.Monthly,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Summary = $"Completed {completed} activities, skipped {skipped}, finished {completedMilestones} milestones, and logged {completedMinutes / 60m:0.#}h of focused work.",
            NextFocus = primaryGoal is null
                ? "Choose one primary goal for next month."
                : $"Keep or deliberately replace the primary goal: {primaryGoal.Title}."
        };

        if (completedMilestones > 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = $"{completedMilestones} milestones moved to done. Carry forward the systems that made them easy.",
                Severity = InsightSeverity.Success
            });
        }

        if (stalledGoals.Count > 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = $"Review stalled goals: {string.Join(", ", stalledGoals.Select(goal => goal.Title))}. Pause, narrow, or redefine them.",
                Severity = InsightSeverity.Warning
            });
        }

        if (metricsWithEntries == 0)
        {
            review.Insights.Add(new ReviewInsight
            {
                Message = "No metric history was logged this month. Add one or two useful signals before adding more.",
                Severity = InsightSeverity.Info
            });
        }

        return review;
    }

    private static decimal CalculateGoalProgress(Goal goal)
    {
        if (goal.TargetValue <= 0)
        {
            return 0;
        }

        return Math.Clamp(goal.CurrentValue / goal.TargetValue * 100, 0, 100);
    }
}
