#!/usr/bin/env bash
# Orchestrated test routine — the daily acceptance loop.
#
# Provisions an ISOLATED throwaway database and a server on DEDICATED ports, runs the full
# unit + integration suite and the full-surface walk against them, then tears everything
# down. It never touches the dev/dogfood stack: different database name (waypoint_routine)
# and different ports (18848/18849), so it is safe to run while `npm run dev` is up.
#
#   npm run test:routine
#
# Exit code is 0 only if the build, migrations, the test suite, AND the walk all pass.
# Overridable: WAYPOINT_PGDATA, WAYPOINT_DB_PORT, WAYPOINT_DB_USER, WAYPOINT_ROUTINE_DB,
# WAYPOINT_ROUTINE_MCP_PORT, WAYPOINT_ROUTINE_HTTP_PORT.
set -uo pipefail # deliberately not -e: capture failures, always reach teardown

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PGDATA="${WAYPOINT_PGDATA:-/tmp/waypoint-pgdata}"
PORT="${WAYPOINT_DB_PORT:-55432}"
DBUSER="${WAYPOINT_DB_USER:-waypoint}"
ROUTINE_DB="${WAYPOINT_ROUTINE_DB:-waypoint_routine}"
MCP_PORT="${WAYPOINT_ROUTINE_MCP_PORT:-18848}"
HTTP_PORT="${WAYPOINT_ROUTINE_HTTP_PORT:-18849}"
ROUTINE_URL="postgresql://$DBUSER@localhost:$PORT/$ROUTINE_DB"
SERVER_LOG="/tmp/waypoint-routine-server.log"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$1"; }

# Locate the Postgres binaries (not on PATH by default on Debian/Ubuntu) — same as dev-db.sh.
PG_CTL_PATH="$(command -v pg_ctl 2>/dev/null || true)"
if [ -n "$PG_CTL_PATH" ]; then PGBIN="$(dirname "$PG_CTL_PATH")"; else
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/pg_ctl" ]; then
  fail "Postgres server binaries not found (install postgresql or set PATH)"
  exit 1
fi

SERVER_PID=""
cleanup() {
  step "Teardown"
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null    # SIGTERM → graceful drain (main.ts handles it)
    wait "$SERVER_PID" 2>/dev/null
  fi
  "$PGBIN/dropdb" -h localhost -p "$PORT" -U "$DBUSER" --if-exists "$ROUTINE_DB" 2>/dev/null
  echo "  routine database dropped; dev stack untouched"
}
trap cleanup EXIT

# Free our dedicated port if a previous routine left a server behind (best-effort).
stale="$(ss -ltnp 2>/dev/null | grep ":$HTTP_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
[ -n "$stale" ] && kill "$stale" 2>/dev/null

# 1. Ensure the dev pg_ctl cluster is up (start it if not), then a pristine throwaway DB.
step "Provision isolated database ($ROUTINE_DB on :$PORT)"
if ! "$PGBIN/pg_isready" -h localhost -p "$PORT" -q 2>/dev/null; then
  [ -d "$PGDATA/base" ] || "$PGBIN/initdb" -D "$PGDATA" -U "$DBUSER" \
    --auth-local=trust --auth-host=trust >/dev/null
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k /tmp" -w -t 30 -l "$PGDATA/server.log" start
fi
"$PGBIN/dropdb" -h localhost -p "$PORT" -U "$DBUSER" --if-exists "$ROUTINE_DB"
"$PGBIN/createdb" -h localhost -p "$PORT" -U "$DBUSER" "$ROUTINE_DB"

# 2. Build only the server chain (shared→core→server) — enough for dist/main.js, and it
#    skips the web workspace so an unrelated in-progress web edit can't break the routine.
step "Build server (tsc -b packages/server)"
if ! npx tsc -b packages/server; then fail "build failed"; exit 1; fi

# 3. Migrate the isolated DB.
step "Migrate"
if ! DATABASE_URL="$ROUTINE_URL" npm run db:migrate; then fail "migrate failed"; exit 1; fi

STATUS=0

# 4. Full unit + integration suite. WAYPOINT_TEST_DATABASE_URL flips the integration tests on
#    (they TRUNCATE between cases — safe here, this DB is throwaway).
step "Unit + integration suite (npm test)"
if ! WAYPOINT_TEST_DATABASE_URL="$ROUTINE_URL" npm test; then
  fail "test suite failed"
  STATUS=1
fi

# 5. Reset to a pristine seeded DB for the walk (the integration tests left it truncated).
step "Seed for the walk"
"$PGBIN/dropdb" -h localhost -p "$PORT" -U "$DBUSER" --if-exists "$ROUTINE_DB"
"$PGBIN/createdb" -h localhost -p "$PORT" -U "$DBUSER" "$ROUTINE_DB"
DATABASE_URL="$ROUTINE_URL" npm run db:migrate >/dev/null 2>&1
if ! DATABASE_URL="$ROUTINE_URL" npm run db:seed; then fail "seed failed"; STATUS=1; fi

# 6. Start the server on dedicated ports against the isolated DB, wait for health.
step "Start server (MCP :$MCP_PORT, REST/WS :$HTTP_PORT)"
DATABASE_URL="$ROUTINE_URL" WAYPOINT_MCP_PORT="$MCP_PORT" WAYPOINT_HTTP_PORT="$HTTP_PORT" \
  node packages/server/dist/main.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
healthy=0
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:$HTTP_PORT/healthz" >/dev/null 2>&1; then healthy=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi # server died
  sleep 0.25
done
if [ "$healthy" -ne 1 ]; then
  fail "server did not become healthy — see $SERVER_LOG"
  tail -20 "$SERVER_LOG" 2>/dev/null
  exit 1
fi

# 7. The full-surface walk against the routine stack.
step "Full-surface walk"
if ! WAYPOINT_MCP_URL="http://localhost:$MCP_PORT/mcp" \
  WAYPOINT_REST="http://localhost:$HTTP_PORT" \
  WAYPOINT_WS="ws://localhost:$HTTP_PORT" \
  WAYPOINT_WALK_PROJECT="default" \
  npm run walk; then
  fail "walk failed"
  STATUS=1
fi

if [ "$STATUS" -eq 0 ]; then
  printf '\n\033[1;32m✓ test routine passed\033[0m\n'
else
  printf '\n\033[1;31m✗ test routine FAILED\033[0m\n'
fi
exit "$STATUS"
