# Tasks

## 1. Mission Control surface

- [x] 1.1 Add `MissionControl.module.css` (axiom tokens, full-screen takeover, top bar, 3-column
      grid, stream progress bar, danger/warning heads-up, footer stat strip).
- [x] 1.2 Write `MissionControl.test.tsx` (red): ready renders a needs-you DecisionCard, an
      active-work line, a stream progress row, the moved feed, and a heads-up; "Enter session" acks the
      digest seq then calls `onClose`; loading + error (custom source whose `digest()` rejects) states
      render.
- [x] 1.3 Implement `MissionControl` ({ projectId, onClose }) over `useReentry` + `useWaypoint`
      (for per-stream progress). Green.

## 2. Verify

- [x] 2.1 `npm test`, `npx tsc -b`, `npx eslint .` (own files clean), `npx prettier --write`.
- [x] 2.2 `npx openspec validate reentry-mission-control --strict`.
