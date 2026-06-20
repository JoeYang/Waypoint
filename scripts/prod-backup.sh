#!/usr/bin/env bash
# Back up the Waypoint PRODUCTION container database (the waypoint_pgdata_prod volume) to a
# local, timestamped, compressed dump, pruning old ones. pg_dump runs INSIDE the postgres
# container because the prod DB is not exposed on the host.
#
#   scripts/prod-backup.sh        (or: npm run prod:backup)
#
# Restore a dump:
#   cat backups/prod-<stamp>.dump | podman exec -i waypoint_postgres_1 \
#     pg_restore -U waypoint -d waypoint --clean --if-exists --no-owner
#
# Overridable: WAYPOINT_PG_CONTAINER, WAYPOINT_DB_USER/NAME, WAYPOINT_BACKUP_DIR, WAYPOINT_BACKUP_KEEP.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTAINER="${WAYPOINT_PG_CONTAINER:-waypoint_postgres_1}"
DBUSER="${WAYPOINT_DB_USER:-waypoint}"
DBNAME="${WAYPOINT_DB_NAME:-waypoint}"
KEEP="${WAYPOINT_BACKUP_KEEP:-14}"
DIR="${WAYPOINT_BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$DIR"

if ! podman container exists "$CONTAINER" ||
  [ "$(podman inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" != "true" ]; then
  echo "✗ prod postgres container '$CONTAINER' is not running"; exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/prod-$STAMP.dump"
echo "▶ backing up $CONTAINER:$DBNAME → $OUT"
if ! podman exec "$CONTAINER" pg_dump -U "$DBUSER" -Fc "$DBNAME" >"$OUT"; then
  echo "✗ pg_dump failed"; rm -f "$OUT"; exit 1
fi
echo "✓ wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Prune: keep the newest $KEEP prod dumps.
ls -1t "$DIR"/prod-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  echo "  pruning $(basename "$old")"; rm -f "$old"
done
