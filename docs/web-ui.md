# Web UI (`packages/web`)

The React/Vite front end, rebuilt from the Claude Design storybook handoff
(`docs/design/storybook-handoff/`). Built **mock-first**: every screen is pixel-faithful to the
prototype and reads from typed fixtures behind a swappable data seam, so the live backend can be
wired in later without rewriting a screen.

## Data seam

```
  screens ─▶ useWaypoint() ─▶ WaypointProvider ─▶ WaypointSource ─▶ { mock | live }
```

- **`wp/types.ts`** — view-model interfaces (`ProjectsData`, `Project`, `Stream`, `Task`,
  `Decision`, `Option`, `Message`, `ActivityGroup`, `Notification`). Web-local on purpose (not in
  `shared`) to avoid premature contract commitment; unions are discriminated. The prototype→backend
  mapping is recorded in comments (e.g. `continuedDescription` → a computed `unblockedTaskCount` at
  wiring). A shape-consistency test stands in for zod this phase.
- **`wp/fixtures.ts`** — `WP_DATA`, the typed port of the prototype's three projects.
- **`wp/source.ts`** — `WaypointSource { getData(): ProjectsData }` + `mockSource`. The live source
  (backed by the kept `api/client.ts` + `inbox/useWaypointStream.ts`) drops in here at the wiring
  phase.
- **`wp/state.ts`** — a pure reducer for navigation + local decision state (`resolve` threads the
  agent's resume message and is a no-op once resolved; `comment` threads you + an agent reply).
  `loadNav`/`saveNav` guard corrupt/absent/throwing storage; `safeNav` corrects a nav pointing at
  data that no longer exists so the UI never renders blank.
- **`wp/WaypointProvider.tsx`** — wires the source to the reducer, persists nav to `localStorage`,
  and exposes `useWaypoint()`. Navigation is **state-based**, not URL routing (matches the
  prototype).

## Screens & overlays (`components/`)

| Surface          | Notes                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| App shell        | `Sidebar` (project switcher + per-project nav) · `TopBar` (breadcrumb, agent pill, clock, bell) |
| Home             | cross-project briefing, stat tiles, project cards                                               |
| Project map      | parallel stream lanes of `TaskNode`s; a blocked node opens its proposal                         |
| Decision inbox   | filterable queue (`all`/`blocking`/`non-blocking`), two empty states                            |
| Proposal         | options with pros/cons + radio select, defer callout, resolve action                            |
| Thread           | agent/you/system messages + a ⌘↩ composer, alongside the proposal                               |
| Activity         | append-only timeline grouped by time, kind-coded dots                                           |
| Settings         | three policy cards of keyboard-operable toggles (local state)                                   |
| Notifications    | popover from the top-bar bell                                                                   |
| Mobile companion | phone-bezel overlay; reversible → approve, one-way → review-on-desktop                          |

Shared primitives: `Badge`, `AgentPill`, `RiskBadge`, `RevBadge`, `Icon`, and the
`typography.module.css` view-chrome. Styling is **CSS modules** (per `frontend.md`), with inline
`style` reserved for genuinely dynamic values (glyph colours, progress-bar widths).

## Conventions

- Prop-driven screens; tests query by role/label (not testid) and cover empty/edge + a11y paths.
- Faithful to the prototype, but **latent prototype bugs are fixed** (and noted in the commit): the
  inbox `"non"` filter (now a total `FilterKind` union) and the `.qico.med` swatch (data carries
  `medium`).
- Serif page headings are scoped under `:global(.axiom)` to beat the design system's element rule.

## Out of scope (deferred to the wiring phase)

Live data, the WebSocket loading/error/retry states, auth, URL routing. The live hero-loop e2e
specs were removed with the old screens and will be re-authored against the live wiring.
