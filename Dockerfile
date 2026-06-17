# Waypoint production image — one process serving MCP (:8848) + REST/WS (:8849) + the built
# web SPA (via @fastify/static, decision D7). Multi-stage: full toolchain builds, slim runtime
# ships. See .claude/rules/docker.md. NOTE: pin `node:22-slim` by digest for reproducible
# prod builds (omitted here; add @sha256:… in your registry).
#
# Build:  docker build -t waypoint .
# Run:    via docker-compose.prod.yml (injects DATABASE_URL + ports at runtime).

# ---- builder: install all deps, compile TS, bundle the web SPA ----
FROM node:22-slim AS builder
WORKDIR /app
# Copy manifests first for layer caching, then install the whole workspace.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/desktop/package.json packages/desktop/
COPY e2e/package.json e2e/
RUN npm ci
COPY . .
RUN npm run build                  # tsc -b → dist for shared/core/server (incl. db/migrate.js)
RUN npm run bundle -w @waypoint/web # vite build → packages/web/dist
RUN npm prune --omit=dev           # strip devDeps (electron, vite, playwright…) from node_modules

# ---- runtime: slim, non-root, prod node_modules + built output only ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV WAYPOINT_MCP_PORT=8848 WAYPOINT_HTTP_PORT=8849
# The server serves the built SPA from here (D7).
ENV WAYPOINT_WEB_ROOT=/app/packages/web/dist
WORKDIR /app

# Pruned prod dependency tree + workspace symlinks (resolve against the package dirs copied below).
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/server/package.json packages/server/
COPY --from=builder /app/packages/server/dist packages/server/dist
# Migration runner reads *.sql relative to dist/db/migrate.js — ship the SQL beside it.
COPY --from=builder /app/packages/server/src/db/migrations packages/server/dist/db/migrations
# Built web SPA (served by the API process).
COPY --from=builder /app/packages/web/dist packages/web/dist
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

USER node
EXPOSE 8848 8849
# Container HEALTHCHECK hits the dependency-free /healthz probe (docker.md).
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.WAYPOINT_HTTP_PORT||8849)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Entrypoint migrates the DB, then exec's the server as PID 1 (so SIGTERM reaches it).
ENTRYPOINT ["/app/docker/entrypoint.sh"]
