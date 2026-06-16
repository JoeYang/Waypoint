# Waypoint storybook UI — design spec

_2026-06-16 · status: approved (build order: mock-first) · source of truth: `docs/design/storybook-handoff/`_

## 1. Purpose

Rebuild the Waypoint web app to match the **Claude Design handoff** prototype — a day-in-the-life,
multi-project async-decision product — pixel-accurate, in our React/Vite codebase. The prototype is the
canonical UI target; this spec is how we recreate it for real and wire it to the live backend later.

Two founder goals it serves, unchanged:

1. **Async decision parking** — the agent parks decisions and keeps working; the human answers later.
2. **Project re-entry** — visualize where the work is so a human can step in and out without losing context.

## 2. Source of truth

The handoff bundle is vendored at `docs/design/storybook-handoff/` (read-only reference, never imported):

| File                          | What it defines                                                                |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `README.md`, `chats/chat1.md` | Intent — read first. Day-in-the-life, multi-project, product-launch fidelity.  |
| `project/wp-data.jsx`         | The complete mock data model (`WP_DATA`). The shape we port to typed fixtures. |
| `project/wp-ui.jsx`           | Shell: `Sidebar`, `TopBar`, `NotificationsPanel`; badges; status helpers.      |
| `project/wp-views.jsx`        | `Home`, `ProjectMap`, `Inbox`, `Activity`, `Settings`.                         |
| `project/wp-proposal.jsx`     | `Proposal` detail + comment `Thread`.                                          |
| `project/wp-mobile.jsx`       | `MobileCompanion` phone overlay.                                               |
| `project/waypoint-app.css`    | 402-line stylesheet — the pixel spec.                                          |
| `project/colors_and_type.css` | Axiom design tokens.                                                           |

**Pixel rule (from the README):** match the visual output. Don't copy the prototype's internal structure
(browser-Babel, window globals) unless it happens to fit — the CSS does, so we port it; the JS does not,
so we rebuild it as typed TSX.

## 3. Keep / rebuild boundary

```
KEEP untouched (mock-first phase):        REBUILD design-led (this phase):
  packages/shared   (contracts)             packages/web/src/  — entire UI
  packages/core     (domain)                  new shell + 7 surfaces + mock layer
  packages/server   (MCP/REST/WS + pg)      SUPERSEDE then delete (final cleanup PR):
KEEP for the LATER wiring phase:              App.tsx, InboxScreen/List/Card, Spine,
  api/client.ts, inbox/useWaypointStream      SpineScreen, their CSS + tests
```

No backend, schema, or MCP-contract change in this phase. The ask-first boundaries stay untouched until
the wiring phase, which gets its own proposal.

## 4. Architecture — the mock seam

The one idea that makes "wire backend later" cheap: screens never know where data comes from.

```
  Screens (Home · Map · Inbox · Proposal · Activity · Settings · Mobile)
        │  read view-models; call onResolve / onComment / onNav
        ▼
  ┌────────────────────────────────────┐
  │  WaypointDataProvider  (React ctx)  │  nav {project,view,decision} + resolve/comment
  │                                     │  state, persisted to localStorage
  └────────────────────────────────────┘
        │  source: a WaypointSource interface — swap the impl, screens unchanged
   ┌────┴───────────────┐        ┌──────────────────────────────┐
   │ mockSource         │ →LATER→ │ liveSource                   │
   │  (wp-fixtures.ts)  │        │  (api/client + useWaypointStream) │
   └────────────────────┘        └──────────────────────────────┘
```

`WaypointSource` (phase-1 interface): `getData(): ProjectsData`, `resolve(id, option)`, `comment(id, text)`.
The mock impl is synchronous over fixtures + local React state; the future live impl is async over the
REST client + WS hook. Screens depend only on the provider's exposed view-models and callbacks.

### Directory layout (`packages/web/src/`)

```
  wp/
    types.ts            view-model types (web-local; reconciled into shared at wiring)
    fixtures.ts         typed port of WP_DATA (orbit-api, atlas-web, ledger-svc)
    source.ts           WaypointSource interface + mockSource
    WaypointProvider.tsx  context: nav + resolve/comment + localStorage
    icons.tsx           the Lucide subset used by the prototype
    helpers.ts          streamProgress, streamBarColor, taskIconName
  components/
    Sidebar.tsx + Sidebar.module.css   TopBar.tsx + .module.css   NotificationsPanel.tsx + .module.css
    Home.tsx  ProjectMap.tsx  Inbox.tsx  Proposal.tsx  Thread.tsx     ← each pairs with a Foo.module.css
    Activity.tsx  Settings.tsx  MobileCompanion.tsx                      whose classes mirror the prototype's
    badges.tsx   (RiskBadge, RevBadge, StatusBadge)                      already-sectioned CSS blocks
  styles/
    axiom-tokens.css    design tokens (:root only), reconciled with the bundle's colors_and_type.css
  App.tsx               shell composition + view router (state-based)
```

CSS is ported as **per-component CSS modules**, not a global stylesheet (frontend.md). The prototype's
`waypoint-app.css` is already sectioned by component, so the split is mechanical: each block (`.sb*` →
`Sidebar.module.css`, `.prop*`/`.opt*`/`.thread*` → split across Proposal/Thread modules, etc.). Dynamic
values (project glyph color, progress-bar width, meter fill) pass as CSS custom properties via `style={}`
— the one inline-style exception frontend.md allows. Screens are **prop-driven** (App/provider pass
`project`/`decision`/callbacks), so each renders in tests from a minimal fixture slice without the provider.

## 5. View-model types (`wp/types.ts`)

Faithful to `WP_DATA`. Summary (full zod-free TS interfaces in code):

- `ProjectsData { now, user{name,email,initials}, projects: Project[], notifications: Notification[] }`
- `Project { id, name, desc, glyph, color, agent: "working"|"idle", agentTasks, streams: Stream[], decisions: Decision[], activity: ActivityGroup[] }`
- `Stream { id, name, status: "done"|"active"|"queued", tasks: Task[] }`
- `Task { name, status: "done"|"active"|"blocked"|"queued", note?, decision?, here? }`
- `Decision { id, risk: "low"|"medium"|"high", reversible, blocking, stream, blocksTask, title, parked, continuedDescription, file, context, options: Option[], recReason, impact:{kind:"info"|"danger", text}, thread: Message[] }`
  — `continuedDescription` is the prototype's free-form "agent continued on N unblocked tasks" string; at
  wiring the live type replaces it with a **computed** `unblockedTaskCount: number` (avoid a silent drift).
- `Option { name, rec?, pros: string[], cons: string[] }`
- `Message { who: "agent"|"you"|"system", t, text }`
- `ActivityGroup { time, items: {kind:"edit"|"parked"|"done"|"you", stream, text, sub}[] }`
- `Notification { id, unread, tone:"warning"|"success"|"accent", icon, project, text, time, to:{project, decision?|view?} }`

**Mapping to the real backend (recorded now, applied at wiring):** prototype `Stream` ≈ our `plan`;
`Decision` ≈ our `ask` with extended fields (risk, reversibility, recommendation, pros/cons, defer-impact);
`ActivityGroup` ≈ our append-only `event` log; `Notification` ≈ derived from open asks + events.

## 6. Design system

- Tokens: the bundle's `colors_and_type.css` is the authority (warm paper, Source Serif 4 / Inter Tight /
  JetBrains Mono, single indigo accent `#3b4cad`, semantic red/amber/green/teal). Reconcile our partial
  `axiom-tokens.css` against it in PR1; vendor any missing vars (`--paper-50..300`, `--ink-300/700/900`,
  `--fg-1..4`, `--accent-50..700`, `--green-600`, `--amber-500`, `--red-500`, `--teal-500`, `--border`,
  `--border-strong`, `--bg`, `--bg-raised`, `--shadow-1..3`, `--dur-1..3`, `--ease-out`).
- **CSS ported as per-component CSS modules** (frontend.md forbids global stylesheets) — decision D1.

## 7. Surface specs

Each surface recreated from its prototype component; states called out for TDD.

1. **App shell** (`Sidebar`, `TopBar`, `NotificationsPanel`). Sidebar: brand (→ Home), project list with
   live/idle dot + decision count-pip + active state, per-project nav (Project map / Decisions+pip /
   Activity / Settings / Mobile companion), user footer. TopBar: breadcrumb (project glyph · name / view),
   agent pill (working `· N tasks` | idle), clock, bell with unread dot. Notifications: scrim + popover,
   tone-colored icons, click → navigate to `to`, "Mark all read".
2. **Home** — briefing banner (dismissible; copy derives from waiting count), 4 stat tiles (decisions
   waiting / agents working / tasks in flight / active streams), 2-col project cards (glyph, name, desc,
   agent pill, top-4 stream progress bars, footer "N decisions waiting" or "All caught up" + Open). Empty
   state: briefing copy still renders; all-caught-up footer.
3. **Project map** — header (N parallel streams, legend), intro line, one `lane` per stream with a
   horizontal connected track of `TaskNode`s. Node states done/active/blocked/queued; `here` → "You are
   here" tag; blocked → "Decision parked" + click → proposal; resolved blocked → "resolved → resuming"
   (active styling). Future connectors dashed.
4. **Inbox** — header `N waiting | All caught up`, filter chips all/blocking/non-blocking, "agent still
   working on N tasks" line, queue rows (risk icon, title, risk+rev+stream badges, "Agent recommends X.
   {first sentence of context}.", parked time, blocking badge, Review). Empty: nothing-waiting vs
   no-match-in-filter. **Fix the prototype's filter bug:** model the filter as `"all" | "blocking" |
"non-blocking"` (a discriminated union); the prototype set state to `"non"` while the predicate checked
   a non-existent branch — the union makes the correct branch compile-checked.
5. **Proposal** — 2-col (proposal + thread). Proposal: badges, serif question, meta (parked · continued ·
   file), "Why this came up", option cards (mono name, radio, pros `+` / cons `−`, "Agent recommends"
   tag), "If you defer" callout (info/danger). Actions: Approve recommendation / Apply {override} /
   reversible hint vs "Needs typed confirmation". Resolved → banner. Thread: messages (agent/you/system
   avatars), composer (⌘↩ to send, disabled when empty). Resolve appends agent "Applied X. Resuming…";
   comment appends you + canned agent reply.
6. **Activity** — vertical timeline, groups by time, dot kinds (done/parked/you/edit), stream tags, subs.
7. **Settings** — three cards (decision policy / notifications / streams) of labeled toggles, local state.
8. **Mobile companion** — full-screen scrim, marketing copy + phone bezel; per-decision cards across all
   projects; reversible → Approve (local done state), one-way → "Review on desktop"; all-clear empty state.

## 8. Interaction & navigation

- Nav state `{project, view, decision}` in the provider, persisted to `localStorage` (key `wp_nav_v1`),
  mirroring the prototype — decision D3. No URL routing this phase.
- `resolve(id, option)`: marks the decision resolved (map node flips to resuming, proposal shows banner,
  inbox/counts drop it) and threads an agent "Applied…/Resuming…" message.
- `comment(id, text)`: appends the human message + a canned agent acknowledgement.

## 9. Error / edge handling

Mock phase has no network, so "failure injection" maps to UI robustness: every surface has an explicit
**empty state** (no decisions, idle project, filtered-to-zero, all-clear mobile); resolving an
already-resolved decision is a no-op; unknown nav (bad project/decision id) falls back to a safe view
(Home or Inbox), never a blank screen; `localStorage` read/write is wrapped in try/catch (corrupt or
unavailable storage → in-memory default). These are asserted in tests. Network failure modes are deferred
to the wiring phase, where the live source adds loading/error/retry states.

## 10. Testing strategy (TDD, red-first)

Vitest + Testing Library, one suite per component. Queries use `getByRole`/`getByLabelText`, not
`getByTestId` (frontend.md line 24). Screens are prop-driven, so each test renders the component with a
minimal fixture slice — no provider needed. Each screen: renders from a fixture; key interactions (resolve
flips state across surfaces; comment threads; filter chips; toggles; nav callbacks); **every empty/edge
state above**. Provider/App integration: nav reducer + resolve/comment reducer + localStorage persistence
and the corrupt-storage fallback.

**Accessibility coverage (frontend.md line 20 — required logical paths, not optional):** icon-only controls
(notification bell, sidebar add, close buttons) carry `aria-label`; the sidebar project list and nav are
keyboard-operable (Tab/Enter); the thread composer's `⌘↩` shortcut is tested; the notifications popover
manages focus (opens to the panel, restores on close). Interactive elements use semantic `<button>`, not
`onClick` divs, wherever the prototype used a div (an accessibility improvement over the source).

Run `npm test` green before each commit; `npx prettier --write .` before each commit. The mock source keeps
tests fast and deterministic (no network). Network loading/error/retry tests arrive with the wiring phase.

## 11. Build sequence (each a PR ≤600 code lines; CSS counts)

| PR  | Scope                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | Tokens reconcile + `wp/types.ts` (interfaces) + `wp/fixtures.ts` (typed `WP_DATA`) + a fixture-shape consistency test. No behavior.                                           |
| 1b  | `WaypointSource`/`mockSource` + `WaypointProvider` (nav + resolve/comment reducers + localStorage w/ fallback) + `wp/icons.tsx` + `wp/helpers.ts`. TDD on reducers + helpers. |
| 2   | App shell: `Sidebar` + `TopBar` + `NotificationsPanel` + their CSS modules + App composition/router + a11y.                                                                   |
| 3   | Home (briefing, stats, project cards) + CSS.                                                                                                                                  |
| 4   | Project map (lanes, task nodes, you-are-here, click-through) + CSS.                                                                                                           |
| 5   | Inbox (queue, filters [union-typed, bug fixed], badges, empty states) + CSS.                                                                                                  |
| 6a  | Proposal detail static render + option selection + defer callout + CSS.                                                                                                       |
| 6b  | `Thread` + composer (`⌘↩`) + resolve/override/typed-confirm interactions + resolved banner + CSS.                                                                             |
| 7   | Activity + Settings + CSS.                                                                                                                                                    |
| 8   | Mobile companion + CSS.                                                                                                                                                       |
| 9   | Cleanup: delete superseded Spine/SpineScreen/Inbox\* + tests; update README/docs.                                                                                             |

PR1a/1b were split from one PR (fixtures alone ~226 typed lines + provider exceed the 600 cap); PR6a/6b
likewise (Proposal+Thread+interactions+tests exceed it). Interfaces/types (1a) land before the components
that use them, per the commit rules.

**Base-branch precondition:** this branch stacks on `feat/project-progress-spine` (D4). Before the redesign
merges to `main`, resolve the still-open "merge slice 2 vs stack" decision and rebase per agent-teams.md
(rebase → green → fast-forward). Not a blocker for building; a release-time step.

## 12. Decisions (pros / cons)

- **D1 — Port the prototype CSS as per-component CSS modules (not a global stylesheet).**
  _Revised after independent review:_ the first draft chose a global stylesheet for speed, but frontend.md
  line 21 forbids global stylesheets. The prototype CSS is already sectioned per component, so the split to
  modules is mechanical and the rendered output is identical — pixel parity is preserved either way.
  Dynamic values (glyph color, bar widths) pass as CSS custom properties via `style={}` (the inline-style
  exception frontend.md allows). _Chosen:_ modules — honors the binding rule at no fidelity cost.
- **D2 — View-model types live in `packages/web`, not `shared`.**
  _Pro:_ no premature contract commitment; `shared`/`core` stay backend-true; reconcile at wiring with
  real measurements. _Con:_ a later reconciliation step. _Chosen_ — mock-first means UI shapes ≠ contracts yet.
- **D5 — Mock fixtures use plain typed interfaces + a shape-consistency test, not zod (this phase).**
  _Review flagged_ typescript.md's "zod at boundaries, infer types." That rule targets **external** input;
  the mock fixtures are trusted internal literals, and adding `zod` to `packages/web` is itself ask-first.
  _Chosen:_ plain interfaces now, guarded by a test asserting all project fixtures share one shape; real
  zod schemas land in `shared` at the wiring phase, where the live data is the actual boundary.
- **D3 — State-based nav + localStorage, not URL routing.**
  _Pro:_ matches the prototype exactly; simplest; no router dep (ask-first). _Con:_ no deep links yet.
  _Chosen_ — add real routes during wiring if wanted.
- **D4 — Branch off `feat/project-progress-spine`, not `main`.**
  _Pro:_ `main` has no web package; this branch carries the Vite scaffolding + api client + WS hook we
  keep. _Con:_ stacks on unmerged slice 2; carries soon-deleted Spine until the cleanup PR. _Chosen_ —
  re-scaffolding web off main is wasteful; cleanup PR removes the dead code.

## 13. Out of scope (this phase)

Backend/contract/schema/MCP changes; real network data; auth; URL routing; the deck (`Waypoint Deck.html`
stays a reference). All deferred to the **wiring phase** (separate proposal): swap `mockSource` →
`liveSource`, extend `shared`/`core`/`server` to back streams, risk/reversibility/recommendation/impact,
activity, and notifications, and add loading/error/retry states.
