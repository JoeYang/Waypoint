# Tasks

## 1. Server: serve web + health + graceful shutdown

- [x] 1.1 Add `/healthz` probe (dependency-free 200)
- [x] 1.2 Serve the built web SPA via `@fastify/static` with deep-link fallback (D7)
- [x] 1.3 Keep the REST API winning over static; JSON 404 for unknown `/v1` routes
- [x] 1.4 SIGTERM/SIGINT graceful drain in `main.ts`; `WAYPOINT_WEB_ROOT` wiring
- [x] 1.5 Tests: health, root index, assets, API-not-shadowed, SPA fallback, JSON 404, bare mode

## 2. Image + stack

- [x] 2.1 Multi-stage Dockerfile (node:22-slim, non-root, pruned prod deps, HEALTHCHECK)
- [x] 2.2 Entrypoint: migrate then exec server as PID 1
- [x] 2.3 `docker-compose.prod.yml`: app + Postgres + dedicated volume, runtime-injected secrets
- [ ] 2.4 Validate `docker build` + `compose up` on a Docker host (no daemon in authoring env)
