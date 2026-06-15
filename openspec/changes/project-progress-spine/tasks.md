## 1. Contracts (interfaces — own commit, before implementation)

- [ ] 1.1 Define the `ProjectProgress` DTO in `shared`: a goal with `state: on-track | at-risk | blocked` + `% plans done` + open-ask count; plans with `state: active | blocked | done`, owning agent, last activity, rolled-up open asks; tasks with `state: running | blocked-on-ask | done | failed`, current agent, and **their open asks in `InboxItem` shape** (so the slice-1 card hydrates from one call). `step` nodes are a kind-aware nested group between plan and task. State definitions are fixed in the proposal's "Decisions settled" section. Infer types from zod.
- [ ] 1.2 Define the REST DTO for `GET /v1/projects/:id/progress` (the spine payload). **Liveness reuses the existing inbox WS signal** — every commit already calls `hub.notify`; the spine refetches `/progress` on that signal. NO new WS frame type (deferred to slice 3).

## 2. Core — the progress read model (TDD over in-memory fakes)

- [ ] 2.1 RED: `listProject(projectId)` returns the three-level tree with per-level state derived from node status, ask state, and `depends_on` edges — one transaction, no N+1, cycle-guarded hierarchy walk → implement.
- [ ] 2.2 RED: rollups are correct — a plan is `blocked` if any task is blocked-on-ask; a goal is `at-risk`/`blocked` per the defined rule; `% plans done` and open-ask counts aggregate from leaves → implement.
- [ ] 2.3 RED: blast radius is reported per node for _weight_, and the read model does NOT impose a sort order (the client decides presentation) → implement.
- [ ] 2.4 Benchmark the read-time rollup against a seeded tree of **50+ nodes (all four kinds) with a non-trivial `depends_on` graph**, budget **p95 < 150 ms** for `GET /progress`. Read-time is the decided default; if the budget is missed the first remedy is a composite index (`project_id, status`), and only then a denormalized projection. Record the decision + numbers. (Blast radius is direct-edge — cheap; the cost to watch is aggregation + the ancestor walk.)

## 3. Persistence — Postgres

- [ ] 3.1 `pg-backend`: implement the progress query set with bounded, parameterized, indexed reads; assert no N+1 and correct rollups against a realistic tree. Integration test gated on `WAYPOINT_TEST_DATABASE_URL`.

## 4. REST + WS (TDD)

- [ ] 4.1 RED: `GET /v1/projects/:id/progress` returns the spine payload with the error envelope and `X-Request-ID`; unknown project → 404 → implement.
- [ ] 4.2 RED: a mutation (transition, answer, park) fires the existing inbox WS signal, and the spine refetches `/progress` on it so it updates live — NO new WS frame type → implement.

## 5. Web — the spine home (TDD, RTL)

- [ ] 5.1 RED: the spine renders a fixed goal header, plan sections with progress, and tasks beneath; asks appear in place on the task they block, using the slice-1 card unchanged → implement.
- [ ] 5.2 RED: importance is shown as visual weight (not sort order); the tree collapses to the live edge by default and is expandable → implement.
- [ ] 5.3 RED: completed work dims/settles and only change moves on live deltas; `prefers-reduced-motion` respected → implement. (Motion polish is the LAST sub-step, after the data shape + live refetch land.)
- [ ] 5.4 RED: the inbox is reachable as a saved lens (filter to "needs you") over the same data, not a separate home, AND remains a stable first-class route (e.g. `/projects/:id/inbox`) so deep-links and tooling built on the V1 inbox keep working → implement.

## 6. Wiring & verification

- [ ] 6.1 Make the spine the application home; demote the inbox route to a lens. Update the demo seed to a multi-plan project so the spine is meaningful.
- [ ] 6.2 `npm test` green; Playwright e2e for the spine + re-home of a card; `openspec validate project-progress-spine --strict`; update README + docs.
