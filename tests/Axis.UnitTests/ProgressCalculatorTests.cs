using Axis.Application.Progress;
using Axis.Domain;

namespace Axis.UnitTests;

public sealed class ProgressCalculatorTests
{
    [Fact]
    public void CalculateGoalProgress_AveragesMilestones()
    {
        var goal = new Goal
        {
            ProgressType = ProgressType.MilestoneBased,
            Milestones =
            [
                new Milestone { CurrentValue = 5, TargetValue = 10 },
                new Milestone { CurrentValue = 10, TargetValue = 10 }
            ]
        };

        var progress = ProgressCalculator.CalculateGoalProgress(goal);

        Assert.Equal(75, progress);
    }

    [Fact]
    public void ApplyDailyDecay_DecaysGradually()
    {
        var progress = ProgressCalculator.ApplyDailyDecay(80, 5, DateTimeOffset.UtcNow.AddDays(-2), DateTimeOffset.UtcNow);

        Assert.InRange(progress, 69, 71);
    }

    [Fact]
    public void ApplyDailyDecay_DoesNotDecayWithoutMaintenanceDate()
    {
        var progress = ProgressCalculator.ApplyDailyDecay(80, 5, null, DateTimeOffset.UtcNow);

        Assert.Equal(80, progress);
    }
}
