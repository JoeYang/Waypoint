#!/bin/sh
# Production entrypoint: apply pending migrations, then hand off (exec) to the server so it
# runs as PID 1 and receives SIGTERM for graceful drain. DATABASE_URL is injected at runtime.
set -e
echo "waypoint: applying migrations…"
node packages/server/dist/db/migrate.js
# Seed the default project (idempotent — ON CONFLICT DO NOTHING) so a brand-new volume is
# usable immediately: agents are told to use projectId "default", which must exist. A no-op
# on an existing database; never overwrites data.
echo "waypoint: ensuring default project…"
node packages/server/dist/db/seed.js
echo "waypoint: starting server…"
exec node packages/server/dist/main.js
