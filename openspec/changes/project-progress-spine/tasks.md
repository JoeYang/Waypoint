## 1. Contracts (interfaces — own commit, before implementation)

- [ ] 1.1 Define the `ProjectProgress` DTO in `shared`: a goal node with `state: on-track | at-risk | blocked` and `% plans done` + open-ask count; plans with `state: active | blocked | done`, owning agent, last activity, rolled-up open asks; tasks with `state: running | blocked-on-ask | done | failed`, current agent, and their asks. Infer types from zod.
- [ ] 1.2 Define the REST DTO for `GET /v1/projects/:id/progress` (the spine payload) and the WS delta shape for progress changes (reuse the existing seq-carried delta where possible).

## 2. Core — the progress read model (TDD over in-memory fakes)

- [ ] 2.1 RED: `listProject(projectId)` returns the three-level tree with per-level state derived from node status, ask state, and `depends_on` edges — one transaction, no N+1, cycle-guarded hierarchy walk → implement.
- [ ] 2.2 RED: rollups are correct — a plan is `blocked` if any task is blocked-on-ask; a goal is `at-risk`/`blocked` per the defined rule; `% plans done` and open-ask counts aggregate from leaves → implement.
- [ ] 2.3 RED: blast radius is reported per node for _weight_, and the read model does NOT impose a sort order (the client decides presentation) → implement.
- [ ] 2.4 Benchmark the read-time rollup against a realistic tree (50+ tasks, non-trivial `depends_on` graph) under an interactive budget. **Decide read-time vs. a denormalized projection updated on event append before building the spine UI.** Record the decision + numbers. (Blast radius is direct-edge — cheap; the cost to watch is aggregation + the ancestor walk.)

## 3. Persistence — Postgres

- [ ] 3.1 `pg-backend`: implement the progress query set with bounded, parameterized, indexed reads; assert no N+1 and correct rollups against a realistic tree. Integration test gated on `WAYPOINT_TEST_DATABASE_URL`.

## 4. REST + WS (TDD)

- [ ] 4.1 RED: `GET /v1/projects/:id/progress` returns the spine payload with the error envelope and `X-Request-ID`; unknown project → 404 → implement.
- [ ] 4.2 RED: a mutation (transition, answer, park) pushes a progress delta over the existing WS seam so the spine updates live → implement.

## 5. Web — the spine home (TDD, RTL)

- [ ] 5.1 RED: the spine renders a fixed goal header, plan sections with progress, and tasks beneath; asks appear in place on the task they block, using the slice-1 card unchanged → implement.
- [ ] 5.2 RED: importance is shown as visual weight (not sort order); the tree collapses to the live edge by default and is expandable → implement.
- [ ] 5.3 RED: completed work dims/settles and only change moves on live deltas; `prefers-reduced-motion` respected → implement.
- [ ] 5.4 RED: the inbox is reachable as a saved lens (filter to "needs you") over the same data, not a separate home, AND remains a stable first-class route (e.g. `/projects/:id/inbox`) so deep-links and tooling built on the V1 inbox keep working → implement.

## 6. Wiring & verification

- [ ] 6.1 Make the spine the application home; demote the inbox route to a lens. Update the demo seed to a multi-plan project so the spine is meaningful.
- [ ] 6.2 `npm test` green; Playwright e2e for the spine + re-home of a card; `openspec validate project-progress-spine --strict`; update README + docs.
