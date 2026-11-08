# Axis architecture

Axis is a local-first application. The React interface and the .NET API are two views of the same SQLite data, whether the app runs through Docker or as the Windows desktop build.

## Safety boundaries

- `data/axis.db` is the source of truth.
- Backup files are owned by `AxisBackupService` and remain compatible across the Docker and Windows runtimes.
- Startup compatibility work belongs in `DatabaseStartupExtensions`. It must be additive and safe to run more than once.
- Starter data is optional. It must never be required to open an existing database.
- Refactors should not rename JSON fields, API routes, database columns, or backup properties unless a migration and compatibility reader are included.

## Backend

The backend follows four layers:

- `Axis.Domain` contains persisted models and domain vocabulary.
- `Axis.Application` contains calculations and output generation that do not need HTTP or database setup.
- `Axis.Infrastructure` contains EF Core, database startup compatibility, backups, and runtime services.
- `Axis.Api` owns HTTP routing and request/response translation.

`Axis.Api/Program.cs` is the composition root. New endpoint groups should be placed in `Axis.Api/Endpoints` and registered from `Program.cs`. Shared request records live in `Axis.Api/Contracts` rather than beside route declarations.

The current extracted modules are:

- `PersonalEndpoints` for focus notes, life lessons, savings, and wishlist routes.
- `CountdownEndpoints` for countdown queries, commands, and dynamic elapsed/remaining values.
- `RoadmapEndpoints` for roadmap/node CRUD, optional Goal links, graph dependencies, cycle prevention, and vertical/horizontal layout persistence. `RoadmapConnections` stores directed edges separately so branching and merging do not duplicate node data. Existing linear roadmap rows are upgraded once into an ordered chain.
- `DiaryDocumentWriter` for DOCX package generation.
- `SignalMetricBackfill` for startup conversion of historical mood and activity data into metrics.

## Frontend

`App.tsx` remains the application coordinator while feature code is progressively moved into focused modules:

- `config.ts` contains stable navigation and option lists.
- `components/common.tsx` contains shared controls and layout primitives.
- `pages/` contains complete feature screens such as Money, Focus, and Life Lessons.
- `lib/format.ts` contains formatting and pagination helpers.
- `lib/sleep.ts` contains sleep duration conversion and guidance.
- `lib/workouts.ts` contains workout serialization, including support for the older exercise format already stored in databases.
- `signals.ts` contains dashboard track calculations.
- `pages/RoadmapsPage.tsx` renders the responsive graph roadmap builder with zoom, curved SVG connections, branch/merge editing, and down/right layout modes. `lib/roadmapLayout.ts` owns deterministic graph layering. Linked Goal milestones are read from the existing Goals state rather than duplicated.

Page components receive data and callbacks through explicit props. They do not call the API directly, which keeps refresh behavior and error handling centralized in `App.tsx`.

## Change checklist

1. Keep API routes and JSON field names stable.
2. Keep old database values readable before introducing a cleaner representation.
3. Add a compatibility test when changing serialized notes or backup data.
4. Run frontend build and tests.
5. Run backend build and unit/integration tests.
6. Verify Docker and Windows builds still point to the same data and backup rules.
