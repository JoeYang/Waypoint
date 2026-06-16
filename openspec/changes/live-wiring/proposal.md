# Live wiring — swap the web mock source for the live backend

## Why

The `storybook-ui` change rebuilt `packages/web` mock-first: every screen reads from a
`WaypointSource` seam (`getData(): ProjectsData`) backed by typed fixtures, deliberately so the
live backend could drop in later "without changing any screen." That later is now. The backend
already serves the data the UI needs (`GET /v1/projects/:id/progress`, `GET /v1/projects/:id/inbox`,
`POST …/asks/:askId/answer`, and a resume-since-seq WebSocket delta stream); the kept artifacts
`api/client.ts` and `inbox/useWaypointStream.ts` are typed against those contracts. This change
makes the screens render live data and answer real asks, and adds the two backend read-endpoints
the redesign needs but the backend does not yet expose.

## The gap (from the contract audit)

The web view-model is a **presentational flattening** of the backend domain:

```
  backend domain                         web view-model (presentational)
  ─────────────                          ───────────────────────────────
  project (by id, per-project seq)       Project { glyph, color, desc, agent, agentTasks }
    goal → plan → (step) → task          Stream { status } → Task { status, here }
      ask (QUESTION|PROPOSAL|DECISION,    Decision { risk, reversible, blocking,
           state machine, blastRadius)              options, recReason, impact, thread }
    event log (verbs, per-project seq)   ActivityGroup / Notification
```

A **web-side adapter** bridges this — screens stay untouched; only the live `WaypointSource`
translates DTOs → view-model. Three things the backend does not serve yet (so, per the agreed
**Full** scope, this change adds them): a cross-project **project list** (the Home aggregates
projects), a **project events** read endpoint (the Activity timeline), and live **agent/now/user**
context. Comments reuse the existing answer contract (see D3).

## What changes

```
  shared ──▶ + risk/reversible on park_ask input + Ask + InboxItem  (D10, MCP-contract)
            + ProjectSummary, ProjectListResponse, EventLogResponse DTOs (zod)
  core   ──▶ + store/surface risk+reversible (default when absent)
            + read-models: listProjects(), readEvents(projectId, sinceSeq?)  (new ports + impl)
  server ──▶ + park_ask accepts risk/reversible; bootstrap instructions updated
            + GET /v1/projects, GET /v1/projects/:id/events  (routes over the new reads)
  web    ──▶ • WaypointSource becomes async: load()/subscribe()/answer()  (mockSource still works)
            • liveSource: progress→Map, inbox→Decisions, events→Activity, projects→Home
            • WaypointProvider gains loading/error/empty states (deferred from the mock phase)
            • resolve→answerAsk (optimistic, expectedVersion, WS reconcile, STALE_VERSION retry)
            • comment→PROPOSAL "adjust" verdict (adjustmentNote); Notifications derived client-side
```

The only contract change is the **additive, backward-compatible** `park_ask` extension (D10 — two
optional fields); the ask state machine and the WS frame schema are unchanged, and the new REST
endpoints are additive reads (no mutation, no schema migration).

## Key decisions (pros/cons)

**D1 — Async seam shape: `load()` + `subscribe()` + `answer()`, not polling.**
The provider calls `load(projectId)` (Promise) for first paint and `subscribe(onDelta)` for live
updates (the WS already pushes deltas with resume-since-seq); `answer()` posts a mutation.
_Pro:_ matches the existing push infrastructure; one render path for mock (load resolves
immediately, subscribe is a no-op) and live. _Con:_ turns the sync `getData()` into async, so the
provider must handle loading/error/empty — but that work was explicitly deferred to this phase.

**D2 — Bridge with a web-side adapter; do not reshape the view-model.**
The live `WaypointSource` maps backend DTOs → the existing `ProjectsData`. _Pro:_ zero screen
churn (the seam's whole point); the presentational shape (glyph/color/risk/“you are here”) stays
UI-owned. _Con:_ the adapter carries real mapping logic (and its own tests); some fields are
derived/approximated (below). Alternative — push the view-model into `shared` and rewrite screens
— was rejected: it couples UI presentation to the wire and discards the mock-phase investment.

**D3 — Comments map to the PROPOSAL "adjust" verdict (your call) — and the verdict RESOLVES the ask.**
Confirmed in `core.ts` (`answer()` sets `ask.state = "ANSWERED"`, and an already-ANSWERED ask
rejects further answers): an "adjust" is a one-shot resolution, not a discussion turn. So at the
UI layer the PROPOSAL composer is **relabelled "Approve with adjustment"** (it resolves and removes
the card), not "comment" — calling it a comment would mislead. For DECISION/QUESTION asks the
composer is hidden and the thread renders read-only from prior messages. _Pro:_ no backend change;
the adjustment surfaces back to the agent via `get_context`. _Con:_ no true mid-decision discussion
this phase; a real comment capability is a later change. The free-form local-only composer of the
mock phase is removed (it would silently no-op against live data).

**D4 — Project presentational fields (glyph/color/desc) come from a small web config map.**
`GET /v1/projects` returns id + name + derived counts (open asks, agent tasks); the UI maps id →
{glyph, color, desc} via a config, falling back to a deterministic glyph/colour from the id.
_Pro:_ no presentational columns bolted onto the domain; _Con:_ unconfigured projects get a
generated look (acceptable; logged, not silent).

**D5 — Activity is derived from the event log via `GET /v1/projects/:id/events`.**
Verb → `ActivityKind`: `ask.parked`→parked, `node.transitioned`(→DONE)→done, `ask.answered`→you,
`node.created`/edits→edit. _Pro:_ the event log is the real audit source (append-only, per-project
seq). _Con:_ a fixed verb→kind mapping may not cover every future verb (unmapped → a neutral
"edit" dot; no crash).

**D6 — Answers are optimistic with optimistic-concurrency reconcile.**
`resolve` sends `expectedVersion` (the ask's `askVersion`); on `STALE_VERSION` (`ApiError.code`)
the source refetches and surfaces a "someone else answered this" reconcile rather than clobbering.
The WS delta is the source of truth that removes the card. _Pro:_ matches the backend's optimistic
concurrency; _Con:_ needs an explicit reconcile path + test (a required failure-injection case).

**D7 — Every async surface gets loading / error+retry / empty states.**
Deferred from the mock phase; now required (frontend.md). The error state carries a retry; the WS
hook already reconnects + resync-on-gap. **`safeNav` must be guarded**: after the seam goes async,
`data` is undefined during the loading frame, so the provider must not run `safeNav(nav, data)`
(which calls `data.projects.find`) until data resolves — else every screen crashes on first paint.

**D8 — `Decision` field provenance: the mock view-model is richer than the backend.**
Five rendered `Decision` fields have **no backend source**; the adapter must derive or fake each
with a documented rule (TypeScript won't catch an `undefined` the adapter constructs into JSX). This
is the single biggest correctness risk and is **enumerated here, not hand-waved**:

| view-model field                | backend source / derivation                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `Decision.blocking`             | `InboxItem.required` (a required OPEN ask blocks its node)                  |
| `Decision.title`                | `InboxItem.prompt`                                                          |
| `Decision.options`              | `InboxItem.options` (label → name, `consequence` → a single con/pro line)   |
| `Decision.recReason`            | the recommended `AskOption` (the `rec` option's label); absent → no rec tag |
| `Decision.context`              | `InboxItem.rationale` (nullable → empty "why this came up")                 |
| `Decision.blocksTask`/`stream`  | the ask's node title / its plan title (from `/progress` ancestry)           |
| `Decision.parked`               | relative label from `InboxItem.parkedAt`                                    |
| `Decision.continuedDescription` | computed from sibling unblocked tasks (was a fixture string)                |
| **`Decision.risk`**             | **agent-supplied** via extended `park_ask` (D10); absent → "medium"         |
| **`Decision.reversible`**       | **agent-supplied** via extended `park_ask` (D10); absent → `true`           |
| `Decision.impact`               | generated text from `blocks`/`blastRadius`; `kind` from the agent's `risk`  |
| `Decision.file`                 | omit (drop the code-ref) unless a node carries a path                       |

**Fork resolved (your call):** `risk` + `reversible` are **agent-supplied** — the agent knows them,
so `park_ask` is extended to carry them (D10) rather than the UI guessing. `impact` stays derived
(text from what the ask blocks; severity from the supplied `risk`); `file` is dropped when absent.

**D10 — Extend `park_ask` so the agent supplies `risk` + `reversibility` (MCP-contract change).**
`park_ask` gains optional `risk` (`low|medium|high`) and `reversible` (boolean); both are stored on
the `Ask` and surfaced on `InboxItem` so the adapter reads real values. Optional → backward
compatible (absent → `medium` / `true`); the MCP `instructions` bootstrap directs agents to supply
them. _Pro:_ the decision's risk/reversibility is the agent's real judgement, not a UI heuristic.
_Con:_ an MCP-contract change (ask-first) that must land **before** the web adapter (PR5) can use it.
**Overlap (flagged):** this enriches `park_ask`, exactly like the pending `decision-context-and-actions`
change (rationale + per-option consequence + suggestedAnswers). To avoid two changes editing the same
tool schema, **recommend reconciling them** — either fold these two fields into that change, or land
this slice first and rebase that change onto it. Sequenced here as group A so live-wiring is
self-contained; happy to move it if you'd rather it live in `decision-context-and-actions`.

**D9 — `now` and `user` have no backend identity (auth is stubbed).**
`ProjectsData.now` resolves from the client clock; `ProjectsData.user` from a static `me` config
until the auth seam lands (auth is out of scope). Documented so it does not slip between PRs.

## Build order (stacked PRs, shared → core → server → web; ≤600 code lines each)

Interfaces/DTOs land before implementation; schema/contract commits are isolated; each PR is
independently shippable (mock stays green until the live source is selected).

1. **shared** — `ProjectSummary` / `ProjectListResponse` / `EventLogResponse` zod schemas (+ inferred types). Types only.
2. **core** — read-model ports `listProjects()` and `readEvents(projectId, sinceSeq?)` + in-memory + Postgres impls; unit tests on port fakes.
3. **server** — `GET /v1/projects` and `GET /v1/projects/:id/events` routes (versioned, error envelope, project-scoped); integration tests.
4. **web** — async `WaypointSource` (`load`/`subscribe`/`answer`); `WaypointProvider` loading/error/empty; `mockSource` adapted to the async shape (suite stays green).
5. **web** — `liveSource` adapter: progress→Project/Stream/Task, inbox→Decision; adapter unit tests over captured DTO fixtures.
6. **web** — answer wiring: `resolve`→`answerAsk` (optimistic + `expectedVersion` + WS reconcile + STALE_VERSION retry); `comment`→PROPOSAL adjust; non-PROPOSAL composer hidden.
7. **web** — Activity←events, Home←project list (+ config map), Notifications derived; per-surface loading/empty.
8. **wiring-e2e + docs** — re-author the live hero-loop e2e (park via MCP → answer in browser → WS removal) against the running stack; update README + `docs/web-ui.md`; `openspec validate --strict`; archive.

## Out of scope

Auth (still stubbed behind the `principal` seam), URL routing, a richer comment/discussion
capability beyond PROPOSAL adjust, the deck, the ask-state-machine, and any `park_ask` enrichment
beyond the two `risk`/`reversible` fields (D10).

## Risks / failure injection (required tests)

- Backend unavailable / timeout on `load` → error state with retry, no blank screen.
- WS drop + resume-since-seq gap → `resync` refetch; inbox re-ranks on delta, never polls.
- `STALE_VERSION` on answer (two humans, or human + agent assumption) → reconcile, no lost write.
- Unknown/absent project id, empty project (no asks) → safe empty states.
- Unmapped event verb / missing presentational config → graceful neutral fallback, logged.
