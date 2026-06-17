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

- [ ] 2.1 RED: `listProjects(): ProjectSummary[]` — a NEW port method (today `ProjectRepository` exposes only `findById`; the `project` table already has id/name/seq_counter so no migration). `openAskCount` from the `ask` table scoped by project; `agentTaskCount` (running tasks) needs a dedicated aggregate query — **avoid the N+1** of loading every project's nodes. In-memory fake → Postgres impl.
- [ ] 2.2 RED: `readEvents(projectId, sinceSeq?): EventEntry[]` port + in-memory fake → impl; append-only order, bounded page.
- [ ] 2.3 Postgres implementations of both ports behind the existing repository; parameterized queries only.

## 3. Server routes (PR3)

- [ ] 3.1 RED: `GET /v1/projects` → `ProjectListResponse` (versioned, consistent error envelope) → implement over `listProjects`.
- [ ] 3.2 RED: `GET /v1/projects/:id/events` → `EventLogResponse` (project-scoped, `sinceSeq` query) → implement over `readEvents`.
- [ ] 3.3 Integration tests (real Postgres/testcontainer): happy path + unknown project + empty.

## 4. Async source seam (PR4 — web, no live calls yet)

- [ ] 4.1 RED: `WaypointSource` becomes `load(projectId?): Promise<ProjectsData>`, `subscribe(onDelta): () => void`, `answer(...): Promise<…>`; `mockSource` satisfies it (load resolves immediately, subscribe no-op).
- [ ] 4.2 RED: `WaypointProvider` loading / error+retry / empty states (frontend.md); **guard `safeNav` so it does not run against undefined `data` during the loading frame** (today it calls `data.projects.find`); existing screen tests stay green against the async mock.
- [ ] 4.3 Failure injection: a rejecting `load` → error state with a retry that re-invokes `load`.

## 5. Live source adapter (PR5 — web)

- [ ] 5.1 RED: `liveSource.load` maps `ProjectProgress` → Project/Stream/Task (`goal/plan/task` state → stream/task status; `blocked-on-ask` → blocked + `Task.decision`; "you are here" from the active task) → implement.
- [ ] 5.2 RED: map `InboxItem` → `Decision` per the **D8 provenance table** — every field has an explicit source, derivation, or documented fallback; the no-source fields (`risk`, `reversible`, `impact`, `file`) follow the agreed rule (derive client-side unless the park_ask-extension fork is taken). No field is left `undefined` into JSX.
- [ ] 5.3 Adapter unit tests over captured DTO fixtures (a real `/progress` + `/inbox` snapshot); unknown enums fall back, never throw; asserts the derived risk/reversible/impact rules explicitly.

## 6. Answer + live updates (PR6 — web)

- [ ] 6.0 RED: change the `resolve` action signature from `(id, optionName)` to carry the backend **`chosenOptionId`** (the reducer/`Proposal.tsx` today pass the option _label_, but `answerAsk` needs the `opt-N` id). Cross-cuts `state.ts` / `source.ts` / `WaypointProvider.tsx` / `Proposal.tsx` + their tests — land the signature change first, mock still green.
- [ ] 6.1 RED: `resolve` → `answerAsk({ chosenOptionId, expectedVersion })`, optimistic; the WS delta (`removedAskIds`) removes the card AND **clears the matching `resolved` entry** so optimistic state reconciles with live data. Implement; subscribe re-ranks the inbox on delta (no poll).
- [ ] 6.2 RED: `STALE_VERSION` `ApiError` → refetch + "already answered" reconcile that also reconciles the `resolved` map, no lost write (failure injection) → implement.
- [ ] 6.3 RED: PROPOSAL composer relabelled **"Approve with adjustment"** → `answerAsk({ proposalVerdict: "adjust", adjustmentNote })` (it RESOLVES the ask — D3); the composer is hidden (thread read-only) for DECISION/QUESTION → implement.

## 7. Activity + Home + Notifications (PR7 — web)

- [ ] 7.1 RED: Activity from `GET …/events` — verb→`ActivityKind` mapping, grouped by time; unmapped verb → neutral dot → implement.
- [ ] 7.2 RED: Home from `GET /v1/projects` + a web config map (id→glyph/color/desc) with a deterministic fallback → implement.
- [ ] 7.3 RED: Notifications derived client-side from open asks + recent events; per-surface loading/empty → implement.

## 8. Live e2e + docs (PR8)

- [ ] 8.1 Re-author the hero-loop e2e (park via MCP → card appears → answer in the browser → WS removal) against the running stack; the WS resume/resync path. **Caveat (document in-test):** the e2e uses a seeded/agreed `projectId` shared between the MCP call and the REST answer URL; it is known-fragile against the auth seam landing — note it so a future auth change is expected to revisit it.
- [ ] 8.2 Update README (web now consumes the live backend) + `docs/web-ui.md` (the live source, adapter, derived fields); full `npm test` + `npm run e2e` green; `openspec validate live-wiring --strict`; archive.
