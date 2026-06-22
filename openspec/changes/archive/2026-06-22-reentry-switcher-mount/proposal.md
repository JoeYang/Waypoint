# Re-entry surface switcher + mount

## Why

The re-entry UI uplift ships three switchable re-entry surfaces — Briefing (`reentry-briefing`),
Mission Control (`reentry-mission-control`), and Timeline (`reentry-timeline`) — all built on the
shared `useReentry` hook and all exposing the same `{ projectId, onClose }` props. Each has landed in
isolation, exercised only by its own test. Nothing yet mounts them in the app, and the only re-entry
affordance the app actually renders is the original flat `WhileYouWereAway` banner (S3, the
single-shape predecessor) pinned atop the project map.

This slice (S3d) completes the S3 re-entry group: it wires the three surfaces behind a **persisted,
switchable preference** and **mounts** the chosen one in place of the old banner, retiring the banner.
A returning human picks which of the three re-entry views greets them; the choice persists across
visits (like nav does), and switching it live swaps the rendered surface. The flat
`WhileYouWereAway` banner is superseded by this richer, switchable surface and is removed.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this reads the
already-fetched digest + story through the existing `WaypointSource`/`useReentry` seam and persists a
single UI preference to `localStorage` (mirroring the existing nav persistence).

- **`reentryPref`** (`packages/web/src/wp/reentryPref.ts`, new) — a tiny persistence helper for the
  chosen direction. `localStorage` key `wp.reentry.direction`, value ∈
  `{"briefing","mission","timeline"}`, default `"briefing"`. `loadDirection` / `saveDirection` take an
  injectable storage and fall back safely on corruption / unavailable storage (mirrors `loadNav` /
  `saveNav`).
- **`ReentrySurface`** (`packages/web/src/components/ReentrySurface.tsx`, new) — props `{ projectId }`.
  Renders a 3-way segmented switcher (`role="radiogroup"`, `aria-label="Re-entry view"`) over
  Briefing / Mission control / Timeline. Selecting one persists the preference and, while a surface is
  open, swaps the rendered direction live. Renders the chosen direction component
  (`Briefing | MissionControl | TimelineDrawer`) when open, passing `{ projectId, onClose }`; `onClose`
  sets open false. Auto-opens once on mount when `useReentry(projectId)` is `ready` and there is
  content to show (open decisions or shipped/moved nodes); a visible "While you were away" trigger
  reopens it after close. Loading / error never crash — render the switcher + trigger only.
- **`App`** (`packages/web/src/App.tsx`) — replace the `<WhileYouWereAway />` mount (and its import) on
  the map view with `<ReentrySurface projectId={…} />`, reading the selected project id from nav the
  same way the rest of the shell does.
- **Removed (superseded):** `WhileYouWereAway.tsx`, `WhileYouWereAway.module.css`, and
  `WhileYouWereAway.test.tsx`. Its coverage is subsumed by the three surface tests + the new
  `ReentrySurface` test; the flat single-shape banner is no longer a product surface.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- New: `packages/web/src/wp/reentryPref.ts` (+ test); `packages/web/src/components/ReentrySurface.tsx`
  (+ `.module.css`, + test).
- Changed: `packages/web/src/App.tsx` (swap the mount + import).
- Removed: `WhileYouWereAway.{tsx,module.css,test.tsx}`.
- Spec: adds a "Re-entry surface selection" requirement; notes the flat single-shape banner is
  superseded by the switchable surface.
