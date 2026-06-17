# Project map: fold completed plans by default

## Why

In the project map, every stream (plan) renders as a lane with its full column of task
nodes always expanded. On a mature project, finished plans dominate the view — a wall of
green "done" task nodes pushes the active and blocked work that actually needs attention
below the fold. The signal-to-noise ratio drops exactly when the project gets interesting.

Completed plans still matter (they provide context and a progress summary), but their
task-level detail is rarely what a human is scanning for. Folding done lanes by default —
while keeping their header and progress summary visible — declutters the map and surfaces
the streams that are still moving or parked.

## What changes

- The project map's lane header becomes an accessible toggle (a real `<button>` with
  `aria-expanded`, keyboard operable) that collapses/expands the lane's task nodes.
- Lanes whose stream `status` is `done` start **collapsed**: the header, status badge, and
  the `N/N done` progress summary stay visible; the task nodes are not rendered.
- Lanes with any other status (`active`, `blocked`, `queued`) start **expanded**, unchanged.
- Clicking (or activating via keyboard) a lane header toggles its expanded state.

This is a web-only, presentational change. No data-source, contract, or backend change.

## Impact

- Affected specs: `storybook-ui` (project map presentation).
- Affected code: `packages/web/src/components/ProjectMap.tsx`, `ProjectMap.module.css`,
  `ProjectMap.test.tsx`.
