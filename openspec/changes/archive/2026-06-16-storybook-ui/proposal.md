## Why

The MVP works end-to-end but is visually thin — there is no tangible product a user can look at and say
"this is useful." Meanwhile the founder produced a high-fidelity **Claude Design handoff** (vendored at
`docs/design/storybook-handoff/`): a day-in-the-life, multi-project Waypoint app that makes both founder
goals concrete — async decision parking and project re-entry. This change rebuilds the web UI to match
that prototype pixel-for-pixel, so there is a real, clickable Waypoint to evaluate.

The prototype is front-end-only (mock data). Our backend has a narrower, different model. Build order is
**mock-first** (decided with the founder): rebuild the UI against a typed fixture layer first — tangible
fast, small per-screen PRs, no premature contract churn — then wire each screen to the live backend in a
later phase (separate proposal). Full design: `docs/superpowers/specs/2026-06-16-waypoint-storybook-ui-design.md`.

## What Changes

- Add a **mock data seam**: a `WaypointSource` interface with a synchronous `mockSource` over typed
  fixtures (a faithful port of the prototype's `WP_DATA`: projects `orbit-api`, `atlas-web`, `ledger-svc`),
  behind a `WaypointProvider` that holds nav + resolve/comment state in `localStorage`. Screens depend
  only on the provider, so the source can later be swapped to a live backend impl without screen rewrites.
- Add the **multi-project app shell** — sidebar (project switcher, per-project nav, decision pips), top
  bar (breadcrumb, agent pill, clock, notification bell), and a notifications popover.
- Add **seven product surfaces** matching the prototype: Home (cross-project landing with morning
  briefing + stats + project cards), Project map (parallel-stream swimlanes with "you are here"),
  Decision inbox (filterable queue), Proposal detail (options with pros/cons, recommendation, defer
  impact, risk/reversibility, **+ a live comment thread**), Activity timeline, Settings, and a Mobile
  companion overlay.
- Add the **resolve→resume and comment→redirect** interactions: answering a decision flips its task node
  to "resuming" and threads an agent acknowledgement; commenting threads a reply.
- **Supersede** the current web surfaces (the inbox screen and the project spine) with the new design; the
  superseded components and their tests are removed in the final cleanup task.

## Capabilities

### Added Capabilities

- `storybook-ui`: a multi-project, mock-backed web prototype of Waypoint that presents projects, a
  parallel-stream project map, a decision inbox, an annotated proposal with a comment thread, an activity
  timeline, settings, and a mobile companion — recreating the Claude Design handoff pixel-accurately, with
  a data seam that allows wiring to the live backend later without rewriting screens.

### Modified Capabilities

- `inbox`: re-presented as the design's decision queue and proposal detail (multi-project, with risk /
  reversibility / recommendation / defer-impact / pros-cons / comment thread). Backed by mock fixtures in
  this phase; the live wiring is a later change.

## Impact

- **Schema / contracts / MCP**: none. No `shared`, `core`, `server`, Postgres, or MCP-tool change in this
  phase. The ask-first boundaries are untouched until the wiring phase.
- **Code**: `packages/web` only. New `wp/` (types, fixtures, source, provider, icons, helpers),
  `components/` (shell + 7 surfaces), ported global `waypoint-app.css`, reconciled `axiom-tokens.css`, and
  a state-based view router in `App.tsx`. The existing `api/client.ts` and `inbox/useWaypointStream.ts`
  are kept untouched for the wiring phase; `InboxScreen/List/Card`, `Spine`, `SpineScreen` and their tests
  are removed in the cleanup task.
- **Design decisions** (full rationale + pros/cons in the design spec): (D1) port the prototype CSS
  ~verbatim as one global stylesheet rather than CSS modules, for pixel parity; (D2) view-model types live
  in `packages/web`, not `shared`, to avoid premature contract commitment; (D3) state-based nav +
  `localStorage`, not URL routing, matching the prototype; (D4) branch off `feat/project-progress-spine`,
  since `main` has no web package.
- **Testing**: TDD per component (Vitest + Testing Library). "Failure injection" in the mock phase = UI
  robustness: explicit empty/edge states on every surface, safe nav fallback for unknown ids, and
  try/catch-guarded `localStorage` with an in-memory fallback. Network loading/error/retry states are
  deferred to the wiring phase.
- **Out of scope**: live data, backend/contract changes, auth, URL routing, the deck. All deferred to the
  wiring phase (separate proposal).

## Decisions settled (independent plan review)

An independent researcher reviewed the plan; findings were triaged (not blanket-applied) and settled here:

- **CSS as modules, not global (accepted blocker).** frontend.md forbids global stylesheets, so the
  prototype CSS is ported as per-component CSS modules; dynamic values pass as CSS custom properties via
  `style={}`. Rendered output is identical, so pixel parity holds.
- **PR1 and PR6 split (accepted blockers).** Fixtures (~226 typed lines) + provider exceed the 600-line
  cap, as do Proposal+Thread+interactions+tests. Split into 1a/1b and 6a/6b.
- **`continuedDescription` (accepted).** The prototype's free-form "continued on N tasks" string is named
  `continuedDescription`; the live type later computes `unblockedTaskCount` — avoids a silent drift.
- **Prop-driven screens for testability (accepted, simpler than proposed).** Screens take `project`/
  `decision`/callbacks as props (as the prototype does), so screen tests use minimal fixture slices with no
  provider; only App/provider get integration tests. No extra read hooks added.
- **Accessibility is in-scope and tested (accepted).** aria-labels on icon-only controls, keyboard
  operability, the thread `⌘↩` shortcut, and focus management on the notifications popover — interactive
  elements use semantic `<button>` where the prototype used `onClick` divs.
- **Inbox filter bug fixed (accepted).** The filter is a `"all" | "blocking" | "non-blocking"` discriminated
  union; the prototype's `"non"` mismatch is compile-checked away.
- **zod deferred to wiring (partial).** typescript.md's zod rule targets external boundaries; mock fixtures
  are trusted internal literals and adding `zod` to `web` is ask-first. Plain interfaces + a fixture-shape
  test now; real zod schemas land in `shared` at the wiring phase.
- **Base-branch precondition (noted).** Stacks on `feat/project-progress-spine`; resolve the open
  merge-vs-stack decision and rebase per agent-teams.md before the redesign merges to `main`.
