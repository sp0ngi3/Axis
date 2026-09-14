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
}
