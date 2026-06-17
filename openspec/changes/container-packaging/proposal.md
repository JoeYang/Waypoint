# Container packaging — isolate dev and prod

## Why

Dev runs on the host (Vite on :5273, user-owned Postgres on :55432 via `dev-db.sh`). There is
no reproducible production environment, and no way to "keep it running" isolated from a
developer's machine. We need a self-contained, deployable stack so prod is byte-reproducible
and cleanly separated from dev.

## What Changes

- A multi-stage **Dockerfile** (`node:22-slim`, non-root, pruned prod deps) that builds the
  workspace and ships one runtime image: the server hosting MCP + REST/WS **and** the built
  web SPA (decision D7 — `@fastify/static`).
- The REST server gains a dependency-free **`/healthz`** probe and **static web serving** with
  SPA deep-link fallback, plus **SIGTERM** graceful drain.
- A **`docker-compose.prod.yml`** (decision D6) running the app image + its own Postgres on a
  dedicated volume, with credentials/`DATABASE_URL` injected at runtime (never baked in).
- An entrypoint that applies migrations, then exec's the server as PID 1.
- The existing `docker-compose.yml` stays dev-only (Postgres for host processes); prod is a
  separate file and volume — the isolation boundary.

## Impact

- New runtime dependency: `@fastify/static` (approved via D7).
- No change to domain `core`; server adapter only. Dev workflow unchanged.
- The image build/run is validated on a Docker host (no daemon in the authoring environment).
