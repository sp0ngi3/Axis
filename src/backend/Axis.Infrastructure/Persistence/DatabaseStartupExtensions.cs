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
        await SeedDefaultsAsync(dbContext, cancellationToken);
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
}
