Each numbered group is one PR (≤600 code lines; docs/specs/lockfiles exempt). TDD red-first;
`npm test` green and `npx prettier --write .` before every commit. Interfaces/DTOs land before
implementation; schema/contract changes are isolated commits. Stacks `shared → core → server → web`.

## A. park_ask risk/reversibility extension (PR-A — MCP-contract, lands first; see D10)

> Overlaps `decision-context-and-actions` (also enriches `park_ask`). Reconcile before starting:
> fold these two fields into that change, or land this slice and rebase that change onto it.

- [x] A.1 shared: added optional `risk` (`low|medium|high`, new `Risk` enum) + `reversible` to the `park_ask` input shape (backward-compatible); own commit; 5 contract tests. (Ask + InboxItem fields land in A.2 with their population so the build never breaks.)
- [x] A.2 core: migration `0003_add_ask_risk` (own commit); `Ask` + `InboxItem` carry the fields; `parkAsk` defaults them (`medium`/`true`) when omitted and `buildInboxItem` surfaces them; Postgres repo reads/writes them (park-time immutable). 3 core tests + fixture updates.
- [x] A.3 server: MCP `park_ask` description + `instructions` bootstrap direct agents to declare risk/reversibility; the inputSchema validates them. 4 boundary tests (instructions mention them, park carries them through, invalid risk rejected).

## 1. Shared DTOs (PR1 — types only)

- [x] 1.1 `ProjectSummary` + `ProjectListResponse` in `packages/shared/src/project.ts` (id, name, openAskCount, agentTaskCount, lastActivityAt?); exported via the entrypoint.
- [x] 1.2 `EventLogResponse` in `event.ts` (projectId, seq, events) reusing the existing `EventSchema`/verbs; inferred types.
- [x] 1.3 8 shape-consistency tests; no behaviour. Build + lint clean.

## 2. Core read-models (PR2)

- [x] 2.1 `listProjects()` core use-case over a NEW `ProjectRepository.listSummaries()` port (open-ask + agent-task counts, last activity). Postgres computes it in ONE aggregate query (grouped subqueries — no N+1); in-memory fake mirrors it. 2 core tests.
- [x] 2.2 `readEvents(projectId, sinceSeq?)` core use-case reusing `EventLog.listSince`; project-existence-checked, `sinceSeq` filter, bounded most-recent page (seq held when none newer). 3 core tests.
- [x] 2.3 Postgres `listSummaries` (parameterized aggregate); `readEvents` reuses the existing pg `listSince`. DB-gated integration case covers both.

## 3. Server routes (PR3)

- [x] 3.1 `GET /v1/projects` → `ProjectListResponse` over `listProjects` (versioned, X-Request-ID, typed-error envelope).
- [x] 3.2 `GET /v1/projects/:id/events` → `EventLogResponse` over `readEvents`; optional `sinceSeq` query, non-integer → 400 VALIDATION; unknown project → 404.
- [x] 3.3 6 route tests (inject) cover counts, append order, sinceSeq filter, invalid sinceSeq, unknown project; the PR2 Postgres integration case covers the read-model over a real DB.

## 4. Async source seam (PR4 — web, no live calls yet)

- [x] 4.1 `WaypointSource` becomes `initial()` (sync seed, keeps screen tests green) + `load(): Promise<ProjectsData>` + `subscribe(onChange): () => void`; `mockSource` satisfies it. (`answer()` joins the seam in PR6 when it's wired — avoiding dead interface surface.)
- [x] 4.2 `WaypointProvider` loading / error+retry / empty states (frontend.md); an outer/inner split renders the context only once data is present, so `safeNav` never runs against null `data`. All existing screen tests stay green against the async mock seed. Verified live (mock renders Home, no white screen).
- [x] 4.3 Failure injection: a rejecting `load` → error state with a retry that re-invokes `load` (test asserts the second attempt succeeds). 5 provider async tests.

## 5. Live source adapter (PR5 — web)

- [x] 5.1 `adapter.ts` pure mappers: `ProjectProgress` → Stream/Task (plan→stream, goals flattened; task states mapped, failed→blocked + non-interactive; `blocked-on-ask` → blocked + `Task.decision` from the first ask). + `fetchProjects`/`fetchEvents` read client. ("you are here" has no backend signal — omitted, documented.)
- [x] 5.2 `toDecision` per the **D8 provenance table** — `risk`/`reversible` are real (agent-supplied via group A); parked is relative; option `consequence` → a pro line; impact severity from risk. No-source fields degrade by rule (no rec tag, no `file`) — never `undefined` into JSX. Note: backend carries no recommended-option flag, so `recReason` is empty (a candidate park_ask extension, like risk/reversible).
- [x] 5.3 8 adapter unit tests over DTO fixtures (status maps, decision provenance, no-source degradation, project assembly incl. deterministic chrome + override) + 2 client tests (project list, events sinceSeq passthrough).

## 6. Answer + live updates (PR6 — web)

- [x] 6.0 No `resolve`-signature change needed: the adapter carries the option `id` + ask `version` onto the view-model, and the provider derives `chosenOptionId` from the chosen option's name — so `Proposal.tsx`/`state.ts` and their tests are untouched (mock stays green).
- [x] 6.1 `resolve` → optimistic dispatch, then `source.answer({ chosenOptionId, expectedVersion })` and **reload** (the backend drives the card leaving on live data; the mock answer is a no-op so its optimistic state stands). + `liveSource` (compose client + adapter) and `answer()` on the seam.
- [x] 6.2 A rejected answer (e.g. `STALE_VERSION`) reconciles via the same reload — no lost write (provider + liveSource tests, mock spy + msw).
- [x] 6.3 The `Thread` composer is kind-aware (live): a PROPOSAL gets **"Approve with adjustment"** → `source.answer` adjust (resolves, per D3); a DECISION/QUESTION is read-only (answered via options); mock decisions (no `kind`) keep the free-form composer. `Decision.kind` carried by the adapter; provider `adjust` action. 6 tests.
- [x] 6.4 `liveSource.subscribe` opens a per-project WebSocket and reloads on any delta/resync (a coarse full-snapshot refresh — no poll; guarded for no-WS envs). On reload, the provider prunes optimistic `resolved`/`threads` entries whose decision is gone (a `prune` reducer action, identity-stable when unchanged). 3 tests (prune ×2, subscribe via a fake WS).

## 7. Activity + Home + Notifications (PR7 — web)

- [x] 7.1 `eventsToActivity` maps the event log to the timeline — verb→`ActivityKind` via an exhaustive `Record` (new verb = compile error, not a silent miss), newest-first, grouped by minute; folded into `Project.activity` by liveSource.
- [x] 7.2 Home from `GET /v1/projects` + the deterministic chrome config (glyph/colour from id, overridable) — done in PR6's liveSource; loading/empty handled by the PR4 provider states.
- [x] 7.3 `deriveNotifications` — a "needs you" card per open decision across projects (no backend notification feed); wired into liveSource. Adapter + liveSource tests.

## 8. Source selection + docs (PR8)

- [x] 8.0 `selectSource(VITE_WAYPOINT_API_BASE)` → live vs mock; `main.tsx` wires it (the bit that makes the live path reachable from the app). 2 tests.
- [x] 8.2 Updated README (point the web at the backend with `VITE_WAYPOINT_API_BASE`) + `docs/web-ui.md` (live source, adapter, status + tracked follow-ups). `npm test` green (331); `tsc -b` + eslint clean.

## 9. Finale (after the deferred follow-ups land)

- [x] 8.1 Hero-loop e2e (`e2e/hero-loop.e2e.ts`): park a DECISION via MCP → open the project's inbox in the live UI → approve → it leaves the queue. Playwright points the web at the backend via `VITE_WAYPOINT_API_BASE` (config). Seeded-project + auth caveat documented in-test. **Authored; runs against a live stack (not in unit CI).**
- [x] 9.x `openspec validate live-wiring --strict` passes; change archived.
