# Axis System Design

## Architecture

- `Axis.Domain`: core entities and enums.
- `Axis.Application`: pure progress/review logic and backup contracts.
- `Axis.Infrastructure`: EF Core SQLite persistence, database initialization, seed data, backup service.
- `Axis.Api`: Minimal API endpoints.
- `src/frontend/axis-web`: React/Vite client.
- `tools/Axis.Launcher`: local Docker Compose launcher.

## Storage

SQLite is mounted through Docker at `/data/axis.db` and mapped to the local `data/` folder.

The first version uses EF Core code-first `EnsureCreated` startup creation. A future migration pass can add generated EF migrations once the MVP schema stabilizes.
