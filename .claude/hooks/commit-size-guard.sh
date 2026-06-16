#!/usr/bin/env bash
# commit-size-guard.sh — PreToolUse(Bash) hook.
# Counts the staged diff size for `git commit` and enforces the project's
# commit-size budget from ~/.claude/CLAUDE.md: warn past the 200 target,
# soft-block past the 400 hard max. Docs, specs, and lockfiles do not count
# (they are exempt from the budget). Tests DO count (budget is "including tests").
#
# Override a justified exception: WAYPOINT_ALLOW_BIG_COMMIT=1 git commit ...
#
# No `set -e`: a hook must never abort the commit on its own plumbing failure.
# Only an over-budget commit (exit 2) blocks; everything else exits 0.

CMD=$(printf '%s' "${CLAUDE_TOOL_INPUT:-}" | jq -r '.command // empty' 2>/dev/null)
case "$CMD" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Sum added+removed lines across staged files, excluding exempt paths.
# Binary files report "-" in numstat — treat as 0.
LINES=$(git diff --cached --numstat -- \
  ':(exclude)*.md' \
  ':(exclude)docs/**' \
  ':(exclude)openspec/**' \
  ':(exclude)**/package-lock.json' \
  ':(exclude)*.lock' \
  2>/dev/null \
  | awk '{ a += ($1=="-"?0:$1); r += ($2=="-"?0:$2) } END { print a + r + 0 }')
LINES=${LINES:-0}

TARGET=200
MAX=400

if [ "$LINES" -gt "$MAX" ]; then
  if [ "${WAYPOINT_ALLOW_BIG_COMMIT:-}" = "1" ]; then
    echo "commit-size-guard: $LINES code lines staged (> $MAX hard max) — allowed via WAYPOINT_ALLOW_BIG_COMMIT=1." >&2
    exit 0
  fi
  echo "commit-size-guard: $LINES code lines staged, over the $MAX hard max (docs/specs/lockfiles excluded; tests count)." >&2
  echo "Split into a smaller single-logical-change commit, or set WAYPOINT_ALLOW_BIG_COMMIT=1 for a justified exception." >&2
  exit 2
fi

if [ "$LINES" -gt "$TARGET" ]; then
  echo "commit-size-guard: $LINES code lines staged, over the $TARGET target (under the $MAX max). Consider splitting." >&2
fi
exit 0
