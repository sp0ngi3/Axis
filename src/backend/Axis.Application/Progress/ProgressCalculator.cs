using Axis.Domain;

namespace Axis.Application.Progress;

public static class ProgressCalculator
{
    public static decimal CalculateGoalProgress(Goal goal)
    {
        if (goal.ProgressType is ProgressType.Manual or ProgressType.MetricBased)
        {
            return CalculateRatio(goal.CurrentValue, goal.TargetValue);
        }

        if (goal.ProgressType is ProgressType.CountBased)
        {
            return CalculateRatio(goal.CurrentValue, goal.TargetValue);
        }

        if (goal.Milestones.Count == 0)
        {
            return CalculateRatio(goal.CurrentValue, goal.TargetValue);
        }

        var total = goal.Milestones
            .Where(milestone => milestone.Status != MilestoneStatus.Archived)
            .Select(milestone => CalculateRatio(milestone.CurrentValue, milestone.TargetValue))
            .DefaultIfEmpty(0)
            .Average();

        return RoundProgress(total);
    }

    public static decimal CalculateRatio(decimal currentValue, decimal targetValue)
    {
        if (targetValue <= 0)
        {
            return 0;
        }

        return RoundProgress(Math.Clamp(currentValue / targetValue * 100, 0, 100));
    }

    public static decimal ApplyWeeklyDecay(decimal progress, decimal weeklyDecayPercent, DateTimeOffset? lastMaintainedAt, DateTimeOffset now)
    {
        if (weeklyDecayPercent <= 0 || lastMaintainedAt is null || progress <= 0)
        {
            return RoundProgress(progress);
        }

        var weeks = Math.Max(0, (decimal)(now - lastMaintainedAt.Value).TotalDays / 7);
        var decayed = progress - weeklyDecayPercent * weeks;

        return RoundProgress(Math.Clamp(decayed, 0, 100));
    }

    private static decimal RoundProgress(decimal value)
    {
        return Math.Round(value, 1, MidpointRounding.AwayFromZero);
    }
}
