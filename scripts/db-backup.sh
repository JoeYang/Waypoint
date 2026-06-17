#!/usr/bin/env bash
# Back up the Waypoint Postgres database with pg_dump.
#
# Writes a timestamped, compressed custom-format dump (pg_dump -Fc) to ./backups, then prunes
# to the most recent N (default 14). Idempotent and safe to run on a schedule (cron) or by hand.
# Matches scripts/dev-db.sh: same connection defaults and the same off-PATH binary lookup
# (the Postgres client tools aren't on PATH by default on Debian/Ubuntu).
#
# Connection: uses $DATABASE_URL if set, else builds it from the dev defaults below.
#   WAYPOINT_DB_PORT (55432) · WAYPOINT_DB_USER (waypoint) · WAYPOINT_DB_NAME (waypoint)
#   WAYPOINT_BACKUP_DIR (./backups) · WAYPOINT_BACKUP_KEEP (14)
#
# Restore a dump into a fresh database:
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backups/waypoint-YYYYMMDD-HHMMSS.dump
# Inspect a dump's contents without restoring:
#   pg_restore -l backups/waypoint-YYYYMMDD-HHMMSS.dump
set -euo pipefail

PORT="${WAYPOINT_DB_PORT:-55432}"
DBUSER="${WAYPOINT_DB_USER:-waypoint}"
DBNAME="${WAYPOINT_DB_NAME:-waypoint}"
HOST="${WAYPOINT_DB_HOST:-localhost}"
KEEP="${WAYPOINT_BACKUP_KEEP:-14}"

# Resolve the backups dir relative to the repo root (this script lives in scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${WAYPOINT_BACKUP_DIR:-$SCRIPT_DIR/../backups}"

# Connection string: never hard-code a password — local dev uses peer/trust auth, and a real
# deployment injects DATABASE_URL from the environment (secrets never live in this script).
DATABASE_URL="${DATABASE_URL:-postgresql://${DBUSER}@${HOST}:${PORT}/${DBNAME}}"

# Locate the Postgres client binaries (not on PATH by default on Debian/Ubuntu).
PG_DUMP_PATH="$(command -v pg_dump 2>/dev/null || true)"
if [ -n "$PG_DUMP_PATH" ]; then
  PGBIN="$(dirname "$PG_DUMP_PATH")"
else
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/pg_dump" ]; then
  echo "error: pg_dump not found (install postgresql-client or set PATH)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/waypoint-$STAMP.dump"

echo "backing up $DBNAME → $OUT"
# -Fc: compressed custom format (selective, restorable with pg_restore). --no-owner keeps the
# dump portable across roles. Fail loudly if the server is unreachable.
"$PGBIN/pg_dump" -d "$DATABASE_URL" -Fc --no-owner -f "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "ok: wrote $SIZE backup"

# Prune to the most recent $KEEP dumps (only our own pattern; never touches anything else).
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/waypoint-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))")
if [ "${#OLD[@]}" -gt 0 ]; then
  echo "pruning ${#OLD[@]} old backup(s), keeping newest $KEEP"
  rm -f "${OLD[@]}"
fi
