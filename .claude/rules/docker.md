---
paths: ["Dockerfile*", "**/Dockerfile", "docker-compose*.yml", "compose.yaml"]
---
# Docker / Container Rules

For the cloud-hosted service (API + MCP + WebSocket) and a local Postgres for dev.

- **Multi-stage builds**: build with the full toolchain, ship a slim runtime image (`node:22-slim` or distroless). Don't ship dev dependencies.
- **Non-root**: run as a non-root user; read-only root filesystem where possible.
- **No secrets in layers**: never `COPY .env` or bake credentials/tokens into the image. Inject config via env at runtime.
- **`.dockerignore`**: exclude `node_modules`, `.git`, `.env*`, `docs/`, test artifacts.
- **Healthcheck**: expose and wire a `/healthz` endpoint; container `HEALTHCHECK` hits it.
- **Pin** base image by digest for reproducible builds; rebuild to pick up CVE patches (don't silently bump app deps).
- **Compose (dev only)**: Postgres + the service; never use the dev compose file or its default credentials in production.
- One process per container; let the orchestrator restart. Handle `SIGTERM` for graceful shutdown (drain WS connections).
