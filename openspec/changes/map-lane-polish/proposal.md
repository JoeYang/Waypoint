# Project-map lane meters + collapsed summaries + map summary strip

## Why

The map uplift gave each stream a collapsible lane (S4-fold) and reworked tasks into a connected
rail (S4a/S4b). But the lane header still reads progress only as a terse "X/Y done" string, a
collapsed _done_ lane looks the same as any other closed header (you can't tell at a glance it's
complete), and the map as a whole offers no top-level read of "how much is live vs parked" nor a
fast way back to where the agent left off. This slice completes the S4 map uplift: it makes
progress legible per-lane (a meter), keeps a collapsed done lane reading as _complete_, and adds a
map-level summary strip with a "jump to where you left off" control.

This is a presentational + small-interaction rework of one screen. No data flow beyond what's
already in the view-model is needed.

## What Changes

In the web **`ProjectMap`** (`packages/web`), all additive:

- **Lane header progress meter** — each lane header gains a slim horizontal meter bar reflecting
  `streamProgress(s).done / .total` (fill width as a CSS-var percentage), beside the existing
  "X/Y done" text. The meter is a `role="progressbar"` with `aria-valuenow/min/max` and an
  `aria-label` of "{stream name} progress".
- **Collapsed done-lane summary** — when a lane is collapsed AND complete (status `done` or
  `done === total`), the header shows a one-line inline summary — a check glyph + "{done}/{total} ·
  all green" — so a collapsed done lane still reads as complete rather than just a closed header.
  Other collapsed lanes keep the current header.
- **Map summary strip** — directly under the title/legend, a strip shows three stats derived from
  `project.streams`: "{streams.length} streams", "{liveEdits} live edits" (tasks with status
  `active`), "{parked} parked" (tasks with status `blocked`); plus a "Jump to where you left off"
  button. The button finds the `here` task, force-expands its lane (through the lane-expansion
  hook), and scrolls it into view. When no `here` task exists the button is omitted.

`useLaneExpansion` gains an `expand(id)` so the jump can force a collapsed target lane open. The
`here` task node gets a stable id so the jump can scroll to it (a small `id` prop threaded
`ProjectMap → TaskNode`). The `scrollIntoView` call is guarded for environments (jsdom) that don't
implement it.

**No MCP-contract or DB-schema change. `packages/web` only.** Completes S4 (map uplift).

## Impact

- `packages/web` only: `components/ProjectMap.{tsx,module.css}` (meter, summary strip,
  collapsed-done summary, jump control + `expand`); `components/TaskNode.tsx` gains an optional
  `id` prop (threaded for the scroll target; default behaviour unchanged).
- The meter is an accessible `progressbar`; the jump is a real `<button>`; markers stay decorative.
