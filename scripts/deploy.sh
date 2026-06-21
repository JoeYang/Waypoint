#!/usr/bin/env bash
# Build + deploy the Waypoint production container locally (rootless podman), or roll back to a
# previously-built revision. Builds from a CLEAN committed tree (never the dirty working tree),
# and tags the image with the git SHA so prior revisions stay available for an instant rollback.
#
#   scripts/deploy.sh            # build HEAD → tag :<sha> + :latest → recreate → verify health
#   scripts/deploy.sh <sha>      # redeploy an already-built :<sha> (rollback — no rebuild)
#
# Never echoes WAYPOINT_DB_PASSWORD. Requires a .env containing WAYPOINT_DB_PASSWORD.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE="localhost/waypoint"
COMPOSE="docker-compose.prod.yml"
HTTP_PORT="${WAYPOINT_HTTP_PORT:-8849}"
LOG="/tmp/waypoint-deploy.log"

ROLLBACK_SHA="${1:-}"
if [ -n "$ROLLBACK_SHA" ]; then
  if ! podman image exists "$IMAGE:$ROLLBACK_SHA"; then
    echo "✗ no image $IMAGE:$ROLLBACK_SHA — build it first (podman images $IMAGE)"; exit 1
  fi
  SHA="$ROLLBACK_SHA"
  echo "↩ rolling back to $IMAGE:$SHA (no rebuild)"
  podman tag "$IMAGE:$SHA" "$IMAGE:latest"
else
  SHA="$(git rev-parse --short HEAD)"
  if ! git diff --quiet HEAD 2>/dev/null; then
    echo "⚠ working tree has uncommitted changes — building from committed HEAD ($SHA), not the worktree"
  fi
  echo "▶ building $IMAGE:$SHA from HEAD"
  if ! git archive HEAD | podman build -t "$IMAGE:$SHA" -t "$IMAGE:latest" - 2>&1 | tail -3; then
    echo "✗ build failed"; exit 1
  fi
fi

# Load the secret WITHOUT printing it; fail fast if absent.
[ -f .env ] || { echo "✗ missing .env (WAYPOINT_DB_PASSWORD)"; exit 1; }
set -a; . ./.env; set +a
[ -n "${WAYPOINT_DB_PASSWORD:-}" ] || { echo "✗ WAYPOINT_DB_PASSWORD not set in .env"; exit 1; }

echo "▶ recreating stack"
podman stop waypoint_app_1 >/dev/null 2>&1 || true
podman rm waypoint_app_1 >/dev/null 2>&1 || true
# podman-compose echoes the full `podman run …` command (which includes DATABASE_URL) — send
# it to a log so the password never reaches the terminal; surface a scrubbed tail only on error.
if ! podman-compose -f "$COMPOSE" up -d >"$LOG" 2>&1; then
  echo "✗ compose up failed:"; grep -vi password "$LOG" | tail -20; exit 1
fi

echo "▶ waiting for health"
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$HTTP_PORT/healthz" >/dev/null 2>&1; then
    echo "✓ deployed $IMAGE:$SHA — healthy at http://localhost:$HTTP_PORT"
    echo "  rollback with: scripts/deploy.sh <previous-sha>   (podman images $IMAGE)"
    exit 0
  fi
  sleep 0.5
done
echo "✗ did not become healthy — inspect: podman logs waypoint_app_1"; exit 1
