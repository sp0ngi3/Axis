using Axis.Api.Contracts;
using Axis.Domain;
using Axis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Axis.Api.Endpoints;

public static class RoadmapEndpoints
{
    public static IEndpointRouteBuilder MapRoadmapEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var roadmaps = endpoints.MapGroup("/api/roadmaps");
        roadmaps.MapGet("/", GetRoadmapsAsync);
        roadmaps.MapPost("/", CreateRoadmapAsync);
        roadmaps.MapPut("/{id:guid}", UpdateRoadmapAsync);
        roadmaps.MapDelete("/{id:guid}", DeleteRoadmapAsync);
        roadmaps.MapPost("/{roadmapId:guid}/items", CreateItemAsync);

        var items = endpoints.MapGroup("/api/roadmap-items");
        items.MapPut("/{id:guid}", UpdateItemAsync);
        items.MapPost("/{id:guid}/move", MoveItemAsync);
        items.MapDelete("/{id:guid}", DeleteItemAsync);

        return endpoints;
    }

    private static async Task<IResult> GetRoadmapsAsync(
        bool? includeArchived,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var query = db.Roadmaps
            .AsNoTracking()
            .Include(roadmap => roadmap.Items)
                .ThenInclude(item => item.Goal)
            .Include(roadmap => roadmap.Connections)
            .AsSplitQuery()
            .AsQueryable();

        if (includeArchived != true)
        {
            query = query.Where(roadmap => !roadmap.IsArchived);
        }

        var roadmaps = (await query.ToListAsync(cancellationToken))
            .OrderBy(roadmap => roadmap.IsArchived)
            .ThenByDescending(roadmap => roadmap.UpdatedAt)
            .Select(ToResponse);

        return Results.Ok(roadmaps);
    }

    private static async Task<IResult> CreateRoadmapAsync(
        RoadmapRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Roadmap title is required.");
        }

        var roadmap = new Roadmap { GraphInitialized = true };
        Apply(roadmap, request);
        db.Roadmaps.Add(roadmap);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Created($"/api/roadmaps/{roadmap.Id}", ToResponse(roadmap));
    }

    private static async Task<IResult> UpdateRoadmapAsync(
        Guid id,
        RoadmapRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Roadmap title is required.");
        }

        var roadmap = await db.Roadmaps
            .Include(item => item.Items)
                .ThenInclude(item => item.Goal)
            .Include(item => item.Connections)
            .AsSplitQuery()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (roadmap is null)
        {
            return Results.NotFound();
        }

        Apply(roadmap, request);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToResponse(roadmap));
    }

    private static async Task<IResult> DeleteRoadmapAsync(
        Guid id,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var roadmap = await db.Roadmaps.FindAsync([id], cancellationToken);
        if (roadmap is null)
        {
            return Results.NotFound();
        }

        db.Roadmaps.Remove(roadmap);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> CreateItemAsync(
        Guid roadmapId,
        RoadmapItemRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Roadmap step title is required.");
        }

        var roadmap = await db.Roadmaps
            .Include(value => value.Items)
            .Include(value => value.Connections)
            .AsSplitQuery()
            .FirstOrDefaultAsync(value => value.Id == roadmapId, cancellationToken);
        if (roadmap is null)
        {
            return Results.NotFound();
        }

        if (!await GoalExistsAsync(request.GoalId, db, cancellationToken))
        {
            return Results.BadRequest("The linked goal does not exist.");
        }

        var dependencies = NormalizeDependencies(request.DependencyIds);
        var dependencyError = ValidateDependencies(roadmap, Guid.Empty, dependencies);
        if (dependencyError is not null)
        {
            return Results.BadRequest(dependencyError);
        }

        var nextOrder = request.SortOrder ?? NextSortOrder(roadmap.Items);
        var item = new RoadmapItem { RoadmapId = roadmapId };
        Apply(item, request, nextOrder);
        db.RoadmapItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        AddIncomingConnections(db, roadmapId, item.Id, dependencies);
        await db.SaveChangesAsync(cancellationToken);

        item.Goal = await FindGoalAsync(item.GoalId, db, cancellationToken);
        return Results.Created($"/api/roadmap-items/{item.Id}", ToItemResponse(item, dependencies));
    }

    private static async Task<IResult> UpdateItemAsync(
        Guid id,
        RoadmapItemRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.BadRequest("Roadmap step title is required.");
        }

        if (!await GoalExistsAsync(request.GoalId, db, cancellationToken))
        {
            return Results.BadRequest("The linked goal does not exist.");
        }

        var item = await db.RoadmapItems.FirstOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (item is null)
        {
            return Results.NotFound();
        }

        var roadmap = await db.Roadmaps
            .Include(value => value.Items)
            .Include(value => value.Connections)
            .AsSplitQuery()
            .FirstAsync(value => value.Id == item.RoadmapId, cancellationToken);
        var dependencies = NormalizeDependencies(request.DependencyIds);
        var dependencyError = ValidateDependencies(roadmap, item.Id, dependencies);
        if (dependencyError is not null)
        {
            return Results.BadRequest(dependencyError);
        }

        Apply(item, request, request.SortOrder ?? item.SortOrder);
        var existingIncoming = roadmap.Connections
            .Where(connection => connection.TargetItemId == item.Id)
            .ToList();
        db.RoadmapConnections.RemoveRange(existingIncoming);
        AddIncomingConnections(db, roadmap.Id, item.Id, dependencies);
        await db.SaveChangesAsync(cancellationToken);
        item.Goal = await FindGoalAsync(item.GoalId, db, cancellationToken);
        return Results.Ok(ToItemResponse(item, dependencies));
    }

    private static async Task<IResult> MoveItemAsync(
        Guid id,
        RoadmapItemMoveRequest request,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var item = await db.RoadmapItems.FindAsync([id], cancellationToken);
        if (item is null)
        {
            return Results.NotFound();
        }

        var siblings = (await db.RoadmapItems
            .Where(value => value.RoadmapId == item.RoadmapId)
            .ToListAsync(cancellationToken))
            .OrderBy(value => value.SortOrder)
            .ThenBy(value => value.CreatedAt)
            .ToList();
        var currentIndex = siblings.FindIndex(value => value.Id == id);
        var targetIndex = Math.Clamp(currentIndex + Math.Sign(request.Direction), 0, siblings.Count - 1);
        if (currentIndex != targetIndex)
        {
            var other = siblings[targetIndex];
            (item.SortOrder, other.SortOrder) = (other.SortOrder, item.SortOrder);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> DeleteItemAsync(
        Guid id,
        AxisDbContext db,
        CancellationToken cancellationToken)
    {
        var item = await db.RoadmapItems.FindAsync([id], cancellationToken);
        if (item is null)
        {
            return Results.NotFound();
        }

        db.RoadmapItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static void Apply(Roadmap roadmap, RoadmapRequest request)
    {
        roadmap.Title = request.Title.Trim();
        roadmap.Description = request.Description?.Trim() ?? string.Empty;
        roadmap.Color = string.IsNullOrWhiteSpace(request.Color) ? "#7f6cff" : request.Color.Trim();
        roadmap.LayoutDirection = NormalizeDirection(request.LayoutDirection);
        roadmap.IsArchived = request.IsArchived;
    }

    private static void Apply(RoadmapItem item, RoadmapItemRequest request, int sortOrder)
    {
        item.GoalId = request.GoalId;
        item.Title = request.Title.Trim();
        item.Description = request.Description?.Trim() ?? string.Empty;
        item.Status = request.Status;
        item.TargetDate = request.TargetDate;
        item.SortOrder = Math.Max(0, sortOrder);
    }

    private static async Task<bool> GoalExistsAsync(Guid? goalId, AxisDbContext db, CancellationToken cancellationToken)
    {
        return goalId is null || await db.Goals.AnyAsync(goal => goal.Id == goalId, cancellationToken);
    }

    private static async Task<Goal?> FindGoalAsync(Guid? goalId, AxisDbContext db, CancellationToken cancellationToken)
    {
        return goalId is null
            ? null
            : await db.Goals.AsNoTracking().FirstOrDefaultAsync(goal => goal.Id == goalId, cancellationToken);
    }

    private static int NextSortOrder(IEnumerable<RoadmapItem> items)
    {
        var lastOrder = items.Select(item => (int?)item.SortOrder).Max();
        return (lastOrder ?? -1) + 1;
    }

    private static object ToResponse(Roadmap roadmap)
    {
        var items = roadmap.Items
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.CreatedAt)
            .Select(item => ToItemResponse(
                item,
                roadmap.Connections
                    .Where(connection => connection.TargetItemId == item.Id)
                    .Select(connection => connection.SourceItemId)))
            .ToList();

        return new
        {
            roadmap.Id,
            roadmap.Title,
            roadmap.Description,
            roadmap.Color,
            roadmap.LayoutDirection,
            roadmap.IsArchived,
            Items = items,
            CompletedItems = roadmap.Items.Count(item => item.Status == RoadmapItemStatus.Completed),
            TotalItems = roadmap.Items.Count,
            roadmap.CreatedAt,
            roadmap.UpdatedAt
        };
    }

    private static object ToItemResponse(RoadmapItem item, IEnumerable<Guid>? dependencyIds = null)
    {
        return new
        {
            item.Id,
            item.RoadmapId,
            item.GoalId,
            GoalTitle = item.Goal?.Title,
            GoalStatus = item.Goal?.Status,
            item.Title,
            item.Description,
            item.Status,
            item.TargetDate,
            item.SortOrder,
            DependencyIds = dependencyIds?.Distinct().ToArray() ?? [],
            item.CreatedAt,
            item.UpdatedAt
        };
    }

    private static IReadOnlyList<Guid> NormalizeDependencies(IReadOnlyList<Guid>? dependencyIds)
    {
        return dependencyIds?.Where(id => id != Guid.Empty).Distinct().ToArray() ?? [];
    }

    private static string? ValidateDependencies(Roadmap roadmap, Guid itemId, IReadOnlyList<Guid> dependencies)
    {
        var itemIds = roadmap.Items.Select(item => item.Id).ToHashSet();
        if (dependencies.Any(id => !itemIds.Contains(id)))
        {
            return "Every dependency must belong to this roadmap.";
        }

        if (itemId != Guid.Empty && dependencies.Contains(itemId))
        {
            return "A roadmap step cannot depend on itself.";
        }

        if (itemId == Guid.Empty)
        {
            return null;
        }

        var adjacency = roadmap.Connections
            .Where(connection => connection.TargetItemId != itemId)
            .GroupBy(connection => connection.SourceItemId)
            .ToDictionary(group => group.Key, group => group.Select(connection => connection.TargetItemId).ToArray());

        foreach (var dependencyId in dependencies)
        {
            if (HasPath(itemId, dependencyId, adjacency))
            {
                return "This connection would create a cycle in the roadmap.";
            }
        }

        return null;
    }

    private static bool HasPath(Guid start, Guid target, IReadOnlyDictionary<Guid, Guid[]> adjacency)
    {
        var pending = new Stack<Guid>();
        var visited = new HashSet<Guid>();
        pending.Push(start);

        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (!visited.Add(current))
            {
                continue;
            }
            if (current == target)
            {
                return true;
            }
            if (adjacency.TryGetValue(current, out var nextItems))
            {
                foreach (var nextItem in nextItems)
                {
                    pending.Push(nextItem);
                }
            }
        }

        return false;
    }

    private static void AddIncomingConnections(
        AxisDbContext db,
        Guid roadmapId,
        Guid targetItemId,
        IEnumerable<Guid> dependencyIds)
    {
        foreach (var sourceItemId in dependencyIds)
        {
            db.RoadmapConnections.Add(new RoadmapConnection
            {
                RoadmapId = roadmapId,
                SourceItemId = sourceItemId,
                TargetItemId = targetItemId
            });
        }
    }

    private static string NormalizeDirection(string? direction)
    {
        return string.Equals(direction, "Horizontal", StringComparison.OrdinalIgnoreCase)
            ? "Horizontal"
            : "Vertical";
    }
}
