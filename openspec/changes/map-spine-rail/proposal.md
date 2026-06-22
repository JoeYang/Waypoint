# Project-map spine rail + you-are-here pulse

## Why

The project map renders each task as a free-standing card with a leading connector — the lane
reads as a stack of boxes, not a _journey_. The design review (S4) wants the map to read as a
connected **rail**: each task rides a vertical spine of status-node markers, so the eye follows
the agent's path down the lane and the "you are here" task is unmistakably the brightest point.
This is a presentational rework of one component — it makes progress legible at a glance, which
is the whole point of the map surface.

## What Changes

Rework the web **`TaskNode`** (`packages/web`) from a card-with-connector into a two-cell row:

- A left **rail** cell — a vertical connector line plus a round **status-node marker**:
  - `done` — filled node with a check glyph (`--green-600`).
  - `active` — glowing accent node WITH a halo/pulse ring; the brightest node on the lane ("you
    are here" emphasis).
  - `blocked`/parked — hollow node with an amber ring (`--amber-500`).
  - `queued` — hollow, faint/dashed node (`--fg-4`); the connector segment above it is dashed
    ("future"), solid otherwise.
- A right **content** cell — the task name + meta (note / "You are here" tag / resolved banner).

Preserved behaviour (no functional change): the "You are here" label still tags `task.here`
(now anchored to the glowing node); `task.note` still shows for a non-here task; a resolved
blocked task still flips to active with the "resolved → resuming" treatment; a blocked task with
an unresolved decision stays the **only interactive node** — a `<button>` (accessible name = the
task name) that calls `onOpenDecision(task.decision)`. The "Decision parked" badge remains as-is
(its inline-actionable rework is the next slice, S4b).

`TaskNode`'s public props are unchanged (`{ task, resolved, onOpenDecision }`). `ProjectMap`
gets a small lane-track class tweak so the rail lines connect between rows; its data flow and
lane logic are untouched.

**No MCP-contract or DB-schema change. `packages/web` only.**

## Impact

- `packages/web` only: `components/TaskNode.{tsx,module.css}` reworked; a small
  `ProjectMap.module.css` tweak so the rail connects between rows. Markers are decorative
  (`aria-hidden`); the interactive blocked node remains a button.
- Follow-ups (separate changes): **S4b** — inline-actionable parked node on the rail; **S4c** —
  lane-level rail polish.
