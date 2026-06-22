# Tasks

## 1. web — component (TDD red→green)

- [x] 1.1 `TaskNode.module.css` rework on the Axiom tokens — rail cell (connector + round
      status-node marker), content cell; per-status marker styling (done check `--green-600`,
      active glow + halo/pulse ring on the accent, parked amber ring `--amber-500`, queued
      hollow/faint `--fg-4` with a dashed future connector segment).
- [x] 1.2 `TaskNode.tsx` restructured into rail + content markup; markers `aria-hidden`; the
      blocked-with-decision node stays a `<button>` (accessible name = task name) calling
      `onOpenDecision`; public props unchanged.
- [x] 1.3 `ProjectMap.module.css` lane-track tweak so the rail connects between rows; no
      `ProjectMap.tsx` data-flow / lane-logic change.
- [x] 1.4 Tests: the four status markers render; the active "you are here" task shows its label
      anchored to the glowing node; a blocked task is a button that calls `onOpenDecision` with the
      decision id; a done task shows its node; a resolved blocked task shows "resolved → resuming"
      and is no longer clickable; queued draws a future (dashed) connector. Keep `ProjectMap` tests
      green.

## Follow-ups (separate changes)

- [ ] S4b — inline-actionable parked node on the rail (replaces the "Decision parked" badge).
- [ ] S4c — lane-level rail polish.
