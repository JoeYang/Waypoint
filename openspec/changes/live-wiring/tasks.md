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
- [ ] 6.3 DEFERRED → PR6b: PROPOSAL composer "Approve with adjustment" needs the ask `type` threaded onto the view-model `Decision` + the `Thread` composer; split out to keep PR6 focused.
- [ ] 6.4 DEFERRED → follow-up: incremental WS push (re-rank on another agent's delta). The human's own answer already refreshes via reload-after-answer; cross-agent live push + the `resolved`↔delta prune land with the WS subscriber.

## 7. Activity + Home + Notifications (PR7 — web)

- [ ] 7.1 RED: Activity from `GET …/events` — verb→`ActivityKind` mapping, grouped by time; unmapped verb → neutral dot → implement.
- [ ] 7.2 RED: Home from `GET /v1/projects` + a web config map (id→glyph/color/desc) with a deterministic fallback → implement.
- [ ] 7.3 RED: Notifications derived client-side from open asks + recent events; per-surface loading/empty → implement.

## 8. Live e2e + docs (PR8)

- [ ] 8.1 Re-author the hero-loop e2e (park via MCP → card appears → answer in the browser → WS removal) against the running stack; the WS resume/resync path. **Caveat (document in-test):** the e2e uses a seeded/agreed `projectId` shared between the MCP call and the REST answer URL; it is known-fragile against the auth seam landing — note it so a future auth change is expected to revisit it.
- [ ] 8.2 Update README (web now consumes the live backend) + `docs/web-ui.md` (the live source, adapter, derived fields); full `npm test` + `npm run e2e` green; `openspec validate live-wiring --strict`; archive.
