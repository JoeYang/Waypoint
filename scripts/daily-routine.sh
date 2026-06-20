#!/usr/bin/env bash
# Daily Waypoint test routine wrapper — the thing a Claude Code routine invokes each day.
#
# It runs the orchestrated routine, captures the full output to a timestamped log, distils a
# compact markdown report, and (best-effort) fires a desktop notification. It deliberately
# does NOT reason about failures or change code: that is the job of the Claude Code routine
# that calls this script, which reads the report + log and investigates (root cause +
# suspected file:line) so a human gets a triaged summary, not raw output.
#
#   bash scripts/daily-routine.sh          # or: npm run routine:daily
#
# Exit code mirrors the routine (0 = all green). Reports land in reports/test-routine/
# (git-ignored run artifacts). Override the location with WAYPOINT_REPORT_DIR.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPORT_DIR="${WAYPOINT_REPORT_DIR:-$ROOT/reports/test-routine}"
mkdir -p "$REPORT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
DATE="$(date +%Y-%m-%d)"
LOG="$REPORT_DIR/$STAMP.log"
REPORT="$REPORT_DIR/$DATE.md"

echo "Waypoint daily test routine — $STAMP"
npm run test:routine 2>&1 | tee "$LOG"
STATUS="${PIPESTATUS[0]}"

if [ "$STATUS" -eq 0 ]; then RESULT="PASS ✅"; else RESULT="FAIL ❌"; fi

# Distil a compact, ANSI-free report for the Claude Code routine to read and reason about.
strip_ansi() { sed -r 's/\x1b\[[0-9;]*m//g'; }
{
  echo "# Waypoint daily routine — $DATE"
  echo
  echo "- Result: **$RESULT**"
  echo "- Run: \`$STAMP\`"
  echo "- Full log: \`$LOG\`"
  echo
  echo "## Phase + suite summary"
  echo '```'
  grep -aE "Test Files|Tests +[0-9]|surfaces in|▶|test routine|✗|FAIL|Error|error:" "$LOG" \
    | strip_ansi | tail -50
  echo '```'
  if [ "$STATUS" -ne 0 ]; then
    echo
    echo "## For the Claude Code routine"
    echo
    echo "The routine FAILED. Identify the failing phase (build / migrate / suite / walk),"
    echo "the root cause, and the suspected \`file:line\`, citing the log above. Do NOT change"
    echo "source code — triage only."
  fi
} >"$REPORT"

# Best-effort desktop notification (same channel the user's hooks already use).
if command -v notify-send >/dev/null 2>&1; then
  notify-send "Waypoint daily routine" "$RESULT — $REPORT" 2>/dev/null || true
fi

echo
echo "report: $REPORT"
echo "result: $RESULT"
exit "$STATUS"
