#!/bin/sh
# Production entrypoint: apply pending migrations, then hand off (exec) to the server so it
# runs as PID 1 and receives SIGTERM for graceful drain. DATABASE_URL is injected at runtime.
set -e
echo "waypoint: applying migrations…"
node packages/server/dist/db/migrate.js
echo "waypoint: starting server…"
exec node packages/server/dist/main.js
