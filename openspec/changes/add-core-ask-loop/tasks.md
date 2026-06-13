## 1. Monorepo scaffold

- [x] 1.1 Initialize npm workspaces with packages `shared`, `core`, `server`, `web`; root `package.json` scripts (build/dev/test/e2e/lint/format/db:migrate)
- [x] 1.2 Add strict root `tsconfig` (base) + per-package configs; project references
- [x] 1.3 Configure ESLint (import-direction layering via `@typescript-eslint/no-restricted-imports` — `eslint-plugin-boundaries` v6 rules are deprecated and misclassify `@waypoint/*` specifiers), Prettier, and Vitest
- [x] 1.4 Configure Playwright for `e2e/` and add a CI-less smoke script; verify `npm test` runs green on an empty suite
- [x] 1.5 Add `.dockerignore` and a dev `docker-compose.yml` with Postgres only

## 2. Shared contracts (interfaces — own commit, before implementation)

- [x] 2.1 Define zod schemas + inferred types for `Project`, `Node` (kind, status spine), `Ask` (type, state union, required, options), `Event`
- [x] 2.2 Define MCP tool arg/result schemas (`get_context`, `create_node`, `park_ask`, `transition`) and REST/WS DTOs
- [x] 2.3 Define typed domain errors (`StaleVersion`, `NotFound`, `Validation`, `BackendUnavailable`) and the repository port interfaces (`ProjectRepository`, `NodeRepository`, `AskRepository`, `EventLog`, `Clock`, `IdGenerator`, plus `UnitOfWork` for atomic mutation+event)

## 3. Core domain — ask-lifecycle (TDD over in-memory fakes)

- [x] 3.1 Write in-memory port fakes for `NodeRepository`, `AskRepository`, `EventLog`, fixed `Clock`
- [x] 3.2 RED: tests for node hierarchy (skippable levels; reject cross-project parent) → implement
- [x] 3.3 RED: tests for `depends_on` edges (acyclic; cross-project rejected) → implement. Blocked-propagation assertion lives in 3.10 with `computeBlocked`.
- [x] 3.4 RED: tests for status spine incl. discard-requires-reason and illegal transitions → implement (version guard introduced here)
- [x] 3.5 RED: tests for parking asks (decision needs ≥2 options) → implement
- [x] 3.6 RED: tests for proceed-on-assumption (`ASSUMED → CONFIRMED/OVERTURNED`, overturn emits re-triage event + bumps node) → implement
- [x] 3.7 RED: tests for answering an ask (atomic with event append) → implement
- [x] 3.8 RED: tests for append-only event log (one sequenced event per mutation, same transaction) → satisfied by the per-use-case event append; locked in with regression suites
- [x] 3.9 RED: tests for optimistic concurrency (stale rejected; overturn-while-DONE race) → version guard already in transition/ask ops; race verified
- [x] 3.10 RED: tests for computed `blocked` + agreement-with-reference property after any mutation → implemented as compute-on-demand (no materialized cache in this slice; spec's MUST holds trivially). Includes the dependency blocked-propagation case deferred from 3.3.
- [x] 3.11 RED: tests for `blast_radius` (direct `depends_on` dependents only) → implement

## 4. Persistence — Postgres (schema migration is its own commit)

- [x] 4.1 First migration (schema only — its own commit): `project`, `node`, `ask`, `event`, `dependency` with `version`, unique `(project_id, seq)`, indexes; reversible down step. Added a no-dep SQL migration runner (`db:migrate` / `db:migrate down`) + bounded pool.
- [x] 4.2 Seed the single default project (separate commit from the schema). Well-known `DEFAULT_PROJECT_ID` shared constant; `db:seed` idempotent.
- [x] 4.3 Integration tests run the same core flows against `createPgBackend` on real Postgres (gated on `DATABASE_URL`, skipped otherwise) → repositories implemented (transactional UoW, `FOR UPDATE` version guard, seq via project counter)
- [x] 4.4 Failure-injection tests: Postgres unavailable → typed `BackendUnavailableError`; transaction rollback leaves no partial state; pool exhaustion degrades gracefully; concurrent writes serialise (one wins, other stale). Serialised test files (`fileParallelism: false`) so DB tests don't clobber each other.

## 5. Agent MCP API (TDD)

- [ ] 5.1 RED: test the Streamable HTTP handshake and tool listing → implement the MCP server transport
- [ ] 5.2 RED: test the `instructions` field directs callers to `get_context` → implement bootstrap. Spike early against Claude Code; if `instructions` is not surfaced to the model, add a CLAUDE.md/AGENTS.md reinforcement fallback
- [x] 5.3 RED: tests for `get_context` (pack contents; unknown-project not-found) → implement
- [x] 5.4 RED: tests for `create_node`, `park_ask`, `transition` (legal spine moves + illegal-move rejection), session-provenance recording on mutation, stale `expected_version`, malformed-arg rejection → implement (thin adapters over core)
- [x] 5.5 RED: graceful-failure test — backend unavailable returns a typed error with no partial state → implement

## 6. Inbox API — REST + WebSocket (TDD)

- [ ] 6.1 RED: tests for inbox listing ranked by blast radius, ties by wait time → implement REST endpoint
- [ ] 6.2 RED: tests for answer endpoint (atomic update + event; stale rejected) → implement
- [ ] 6.3 RED: tests for WebSocket delta push + resume-since-seq → implement (event emitter + per-connection subscription)
- [ ] 6.4 Failure-injection tests: dropped connection mid-answer, out-of-order frames, reconnect gap → assert no missed/duplicated deltas

## 7. Web inbox screen (TDD)

- [ ] 7.1 RED (RTL): Inbox renders ranked cards with "blocks N" badge; loading/error/empty states → implement
- [ ] 7.2 RED (RTL): `useWaypointStream` hook applies deltas idempotently and re-ranks → implement
- [ ] 7.3 RED (RTL): answering a card flips it to "working" and the next ask rises → implement
- [ ] 7.4 Playwright e2e: park an ask via MCP → it appears top of inbox → answer → card flips to working → queue re-ranks

## 8. Wiring & verification

- [ ] 8.1 Compose the full loop locally (server + web + Postgres via docker-compose); manual smoke of the hero flow
- [ ] 8.2 Run `npm test -- --coverage` (all logical paths) and `npm run e2e`; fix gaps
- [ ] 8.3 `openspec validate add-core-ask-loop --strict`; update README with build/run instructions
