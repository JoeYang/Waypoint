# deployment

## ADDED Requirements

### Requirement: Production container image

The system SHALL provide a multi-stage container image that runs the MCP, REST, and WebSocket
server and serves the built web SPA from a single process, configured entirely via runtime
environment variables (no secrets baked into image layers).

#### Scenario: Health probe

- **WHEN** an orchestrator requests `GET /healthz`
- **THEN** the server responds `200` with `{ "status": "ok" }` without touching the database

#### Scenario: Web served by the API process

- **WHEN** `WAYPOINT_WEB_ROOT` points at the built SPA and a browser requests `/`
- **THEN** the server returns `index.html`, and a client-side deep link falls back to it
- **AND** requests to `/v1/*` still reach the REST API and unknown `/v1/*` routes return a JSON 404

#### Scenario: Graceful shutdown

- **WHEN** the container receives `SIGTERM`
- **THEN** the server drains in-flight connections and exits cleanly

### Requirement: Isolated production stack

The system SHALL provide a production compose stack that runs the app image with its own
Postgres instance on a dedicated volume, separate from the dev-only compose file and the
host dev database.

#### Scenario: Requires explicit credentials

- **WHEN** the prod stack starts without `WAYPOINT_DB_PASSWORD`
- **THEN** startup fails rather than falling back to a development default

#### Scenario: Migrations applied before serving

- **WHEN** the app container starts
- **THEN** pending database migrations are applied before the server begins accepting requests
