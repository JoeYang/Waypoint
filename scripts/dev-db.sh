#!/usr/bin/env bash
# One-command local dev database for Waypoint.
#
# Brings up a user-owned Postgres (no Docker, no sudo), then migrates and seeds it.
# Idempotent — safe to re-run. Chosen over docker-compose because the Docker daemon isn't
# available in this environment (decision recorded in Waypoint itself).
#
# Override with WAYPOINT_PGDATA / WAYPOINT_DB_PORT / WAYPOINT_DB_USER / WAYPOINT_DB_NAME.
# Note: the default data dir lives under /tmp and is cleared on reboot — re-run this script.
set -euo pipefail

PGDATA="${WAYPOINT_PGDATA:-/tmp/waypoint-pgdata}"
PORT="${WAYPOINT_DB_PORT:-55432}"
DBUSER="${WAYPOINT_DB_USER:-waypoint}"
DBNAME="${WAYPOINT_DB_NAME:-waypoint}"

# Locate the Postgres server binaries (not on PATH by default on Debian/Ubuntu).
PG_CTL_PATH="$(command -v pg_ctl 2>/dev/null || true)"
if [ -n "$PG_CTL_PATH" ]; then
  PGBIN="$(dirname "$PG_CTL_PATH")"
else
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "error: Postgres server binaries not found (install postgresql or set PATH)" >&2
  exit 1
fi

if [ ! -d "$PGDATA/base" ]; then
  "$PGBIN/initdb" -D "$PGDATA" -U "$DBUSER" --auth-local=trust --auth-host=trust >/dev/null
  echo "initialized cluster at $PGDATA"
fi

if ! "$PGBIN/pg_isready" -h localhost -p "$PORT" -q 2>/dev/null; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k /tmp" -w -t 30 -l "$PGDATA/server.log" start
fi

if ! psql "postgresql://$DBUSER@localhost:$PORT/postgres" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$DBNAME'" | grep -q 1; then
  "$PGBIN/createdb" -h localhost -p "$PORT" -U "$DBUSER" "$DBNAME"
  echo "created database $DBNAME"
fi

export DATABASE_URL="postgresql://$DBUSER@localhost:$PORT/$DBNAME"
npm run db:migrate
npm run db:seed

echo ""
echo "Waypoint dev database ready."
echo "  DATABASE_URL=$DATABASE_URL"
echo "Start the MCP server with:"
echo "  DATABASE_URL=$DATABASE_URL npm start -w @waypoint/server"
