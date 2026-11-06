using Axis.Api.Contracts;
using Axis.Domain;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Axis.Api.Endpoints;

public static class CountdownEndpoints
{
    public static IEndpointRouteBuilder MapCountdownEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/countdowns");

        group.MapGet("/", GetCountdownsAsync);
        group.MapPost("/", CreateCountdownAsync);
        group.MapPut("/{id:guid}", UpdateCountdownAsync);
        group.MapDelete("/{id:guid}", DeleteCountdownAsync);

        return endpoints;
    }

    private static async Task<IResult> GetCountdownsAsync(
        bool? includeArchived,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var query = db.Countdowns.AsQueryable();
        if (includeArchived != true)
        {
            query = query.Where(countdown => !countdown.IsArchived);
        }

        var countdowns = (await query.ToListAsync(cancellationToken))
            .OrderByDescending(countdown => countdown.IsPinned)
            .ThenBy(countdown => countdown.TargetAt)
            .Select(ToResponse);

        return Results.Ok(countdowns);
    }

    private static async Task<IResult> CreateCountdownAsync(
        CountdownRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Title is required.");
        }

        var countdown = new Countdown();
        ApplyRequest(countdown, request);

        db.Countdowns.Add(countdown);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/countdowns/{countdown.Id}", ToResponse(countdown));
    }

    private static async Task<IResult> UpdateCountdownAsync(
        Guid id,
        CountdownRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var countdown = await db.Countdowns.FindAsync([id], cancellationToken);
        if (countdown is null)
        {
            return Results.NotFound();
        }

        ApplyRequest(countdown, request);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(countdown));
    }

    private static async Task<IResult> DeleteCountdownAsync(
        Guid id,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var countdown = await db.Countdowns.FindAsync([id], cancellationToken);
        if (countdown is null)
        {
            return Results.NotFound();
        }

        db.Countdowns.Remove(countdown);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static void ApplyRequest(Countdown countdown, CountdownRequest request)
    {
        countdown.Title = request.Title.Trim();
        countdown.Description = request.Description?.Trim() ?? string.Empty;
        countdown.TargetAt = request.TargetAt;
        countdown.Category = request.Category?.Trim() ?? string.Empty;
        countdown.Color = string.IsNullOrWhiteSpace(request.Color) ? "#d060e8" : request.Color.Trim();
        countdown.IsPinned = request.IsPinned;
        countdown.IsArchived = request.IsArchived;
    }

    private static object ToResponse(Countdown countdown)
    {
        var remaining = countdown.TargetAt - DateTimeOffset.UtcNow;
        var totalSeconds = Math.Max(0, remaining.TotalSeconds);
        var createdDate = DateOnly.FromDateTime(countdown.CreatedAt.LocalDateTime);
        var targetDate = DateOnly.FromDateTime(countdown.TargetAt.LocalDateTime);
        var today = DateOnly.FromDateTime(DateTime.Now);
        var totalDurationDays = Math.Max(0, targetDate.DayNumber - createdDate.DayNumber);
        var elapsedDays = Math.Clamp(today.DayNumber - createdDate.DayNumber, 0, totalDurationDays);
        var (calendarMonths, calendarDays) = CalendarMonthDayDifference(createdDate, targetDate);

        return new
        {
            countdown.Id,
            countdown.Title,
            countdown.Description,
            countdown.TargetAt,
            countdown.Category,
            countdown.Color,
            countdown.IsPinned,
            countdown.IsArchived,
            DaysRemaining = (int)Math.Floor(totalSeconds / 86400),
            HoursRemaining = (int)Math.Floor(totalSeconds % 86400 / 3600),
            MinutesRemaining = (int)Math.Floor(totalSeconds % 3600 / 60),
            TotalDurationDays = totalDurationDays,
            ElapsedDays = elapsedDays,
            CalendarMonths = calendarMonths,
            CalendarDays = calendarDays,
            IsPast = remaining.TotalSeconds < 0,
            countdown.CreatedAt,
            countdown.UpdatedAt
        };
    }

    private static (int Months, int Days) CalendarMonthDayDifference(DateOnly start, DateOnly end)
    {
        if (end <= start)
        {
            return (0, 0);
        }

        var months = (end.Year - start.Year) * 12 + end.Month - start.Month;
        while (months > 0 && start.AddMonths(months) > end)
        {
            months--;
        }

        return (months, end.DayNumber - start.AddMonths(months).DayNumber);
    }
}
