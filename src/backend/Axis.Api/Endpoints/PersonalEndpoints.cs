using Axis.Api.Contracts;
using Axis.Domain;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Axis.Api.Endpoints;

public static class PersonalEndpoints
{
    public static void MapPersonalEndpoints(this WebApplication app)
    {
        MapLifeLessons(app);
        MapFocusNotes(app);
        MapMoney(app);
    }

    private static void MapLifeLessons(WebApplication app)
    {
        var group = app.MapGroup("/api/life-lessons");

        group.MapGet("/", async (AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var lessons = (await db.LifeLessons.AsNoTracking().ToListAsync(cancellationToken))
                .OrderByDescending(lesson => lesson.IsPinned)
                .ThenByDescending(lesson => lesson.CreatedAt);
            return Results.Ok(lessons);
        });

        group.MapPost("/", async (LifeLessonRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (!IsValid(request)) return Results.BadRequest("Title and lesson are required.");

            var lesson = new LifeLesson();
            Apply(lesson, request);
            db.LifeLessons.Add(lesson);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/life-lessons/{lesson.Id}", lesson);
        });

        group.MapPut("/{id:guid}", async (Guid id, LifeLessonRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (!IsValid(request)) return Results.BadRequest("Title and lesson are required.");

            var lesson = await db.LifeLessons.FindAsync([id], cancellationToken);
            if (lesson is null) return Results.NotFound();

            Apply(lesson, request);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(lesson);
        });

        group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var lesson = await db.LifeLessons.FindAsync([id], cancellationToken);
            if (lesson is null) return Results.NotFound();

            db.LifeLessons.Remove(lesson);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
    }

    private static bool IsValid(LifeLessonRequest request)
    {
        return !string.IsNullOrWhiteSpace(request.Title) && !string.IsNullOrWhiteSpace(request.Content);
    }

    private static void Apply(LifeLesson lesson, LifeLessonRequest request)
    {
        lesson.Title = request.Title.Trim();
        lesson.Content = request.Content.Trim();
        lesson.Category = request.Category?.Trim() ?? string.Empty;
        lesson.Source = request.Source?.Trim() ?? string.Empty;
        lesson.IsPinned = request.IsPinned;
    }

    private static void MapFocusNotes(WebApplication app)
    {
        var group = app.MapGroup("/api/focus-notes");

        group.MapGet("/", async (bool? includeArchived, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var query = db.FocusNotes.AsNoTracking().AsQueryable();
            if (includeArchived != true)
            {
                query = query.Where(note => !note.IsArchived);
            }

            var notes = (await query.ToListAsync(cancellationToken))
                .OrderByDescending(note => note.IsPinned)
                .ThenByDescending(note => note.UpdatedAt);
            return Results.Ok(notes);
        });

        group.MapPost("/", async (FocusNoteRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (!IsValid(request)) return Results.BadRequest("A focus note needs a title or content.");

            var note = new FocusNote();
            Apply(note, request);
            db.FocusNotes.Add(note);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/focus-notes/{note.Id}", note);
        });

        group.MapPut("/{id:guid}", async (Guid id, FocusNoteRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (!IsValid(request)) return Results.BadRequest("A focus note needs a title or content.");

            var note = await db.FocusNotes.FindAsync([id], cancellationToken);
            if (note is null) return Results.NotFound();

            Apply(note, request);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(note);
        });

        group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var note = await db.FocusNotes.FindAsync([id], cancellationToken);
            if (note is null) return Results.NotFound();

            db.FocusNotes.Remove(note);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
    }

    private static bool IsValid(FocusNoteRequest request)
    {
        return !string.IsNullOrWhiteSpace(request.Title) || !string.IsNullOrWhiteSpace(request.Content);
    }

    private static void Apply(FocusNote note, FocusNoteRequest request)
    {
        note.Title = request.Title?.Trim() ?? string.Empty;
        note.Content = request.Content?.Trim() ?? string.Empty;
        note.Label = request.Label?.Trim() ?? string.Empty;
        note.Color = string.IsNullOrWhiteSpace(request.Color) ? "#7f6cff" : request.Color.Trim();
        note.IsPinned = request.IsPinned;
        note.IsArchived = request.IsArchived;
    }

    private static void MapMoney(WebApplication app)
    {
        MapSavings(app);
        MapWishlist(app);
    }

    private static void MapSavings(WebApplication app)
    {
        var group = app.MapGroup("/api/money/savings");

        group.MapGet("/", async (AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var entries = (await db.SavingsEntries.AsNoTracking().ToListAsync(cancellationToken))
                .OrderByDescending(entry => entry.RecordedAt);
            return Results.Ok(entries);
        });

        group.MapPost("/", async (SavingsEntryRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var entry = new SavingsEntry
            {
                RecordedAt = DateTimeOffset.Now,
                Amount = Math.Max(0, request.Amount),
                Note = request.Note?.Trim() ?? string.Empty
            };
            db.SavingsEntries.Add(entry);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/money/savings/{entry.Id}", entry);
        });

        group.MapPut("/{id:guid}", async (Guid id, SavingsEntryRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var entry = await db.SavingsEntries.FindAsync([id], cancellationToken);
            if (entry is null) return Results.NotFound();

            entry.Amount = Math.Max(0, request.Amount);
            entry.Note = request.Note?.Trim() ?? string.Empty;
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(entry);
        });

        group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var entry = await db.SavingsEntries.FindAsync([id], cancellationToken);
            if (entry is null) return Results.NotFound();

            db.SavingsEntries.Remove(entry);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
    }

    private static void MapWishlist(WebApplication app)
    {
        var group = app.MapGroup("/api/money/wishlist");

        group.MapGet("/", async (AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var items = (await db.WishlistItems.AsNoTracking().ToListAsync(cancellationToken))
                .OrderBy(item => item.IsPurchased)
                .ThenBy(item => item.Priority)
                .ThenByDescending(item => item.CreatedAt);
            return Results.Ok(items);
        });

        group.MapPost("/", async (WishlistItemRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest("Name is required.");

            var item = new WishlistItem();
            Apply(item, request);
            db.WishlistItems.Add(item);
            await db.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/money/wishlist/{item.Id}", item);
        });

        group.MapPut("/{id:guid}", async (Guid id, WishlistItemRequest request, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest("Name is required.");

            var item = await db.WishlistItems.FindAsync([id], cancellationToken);
            if (item is null) return Results.NotFound();

            Apply(item, request);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Ok(item);
        });

        group.MapDelete("/{id:guid}", async (Guid id, AxisDbContext db, CancellationToken cancellationToken) =>
        {
            var item = await db.WishlistItems.FindAsync([id], cancellationToken);
            if (item is null) return Results.NotFound();

            db.WishlistItems.Remove(item);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
    }

    private static void Apply(WishlistItem item, WishlistItemRequest request)
    {
        var wasPurchased = item.IsPurchased;
        item.Name = request.Name.Trim();
        item.Description = request.Description?.Trim() ?? string.Empty;
        item.Price = Math.Max(0, request.Price);
        item.Priority = Math.Clamp(request.Priority, 1, 5);
        item.IsPurchased = request.IsPurchased;
        item.PurchasedAt = request.IsPurchased
            ? item.PurchasedAt ?? DateTimeOffset.Now
            : wasPurchased ? null : item.PurchasedAt;
    }
}
