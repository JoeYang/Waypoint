## 1. Contracts (interfaces — own commit, before implementation)

- [x] 1.1 Define the `StoryEntry` DTO (a node-threaded, human-legible projection of an event: actor, verb, target node, summary, seq, at) and the `Digest` DTO (since-last-seen: shipped, newly-blocked, waiting — rolled up across the three levels). Infer from zod.
- [x] 1.2 Define the notification contract: a `NotificationPolicy` (cadence, blast-radius threshold, age SLA — all user-set, **persisted**) and the escalation decision input (ask blast radius + age + count of waiting asks) + decision output (`push` | `batch`). Transport-agnostic. Define the `digest.ready` WS frame (carries `seq` + non-sensitive summary only) alongside the existing delta/resync frames.

## 2. Schema (migration — its own commit)

- [x] 2.1 Migration: add a **new `principal_cursor` table** `(principal, project_id, last_seen_seq)` PK `(principal, project_id)` — the per-principal read cursor (not a column on an existing table). Add a **`notification_policy`** carrier (cadence, blast_radius_threshold, age_sla_seconds) keyed the same way. Reversible down. The event log is untouched (append-only). Pre-auth, both key on a well-known default principal via the `principal` seam (mirroring `DEFAULT_PROJECT_ID`).

## 3. Core — projections (TDD over in-memory fakes)

- [x] 3.1 RED: `story(projectId, sinceSeq, limit)` projects the event log into node-threaded narrative entries, oldest-first, **bounded by `limit`**, with no source mutation; the actor is resolved from `ask.agent_label` / the session alias (no event-table change) → implement.
- [x] 3.2 RED: `digest(projectId, lastSeenSeq, limit)` summarizes since the cursor — what shipped, what is newly blocked, what is waiting — rolled up across goal/plan/task, **bounded** → implement.
- [x] 3.3 RED: the escalation decision — given a `NotificationPolicy` and an ask's blast radius + age, decide push-now vs. batch — is a pure `core` use-case that depends on **both `AskRepository` and `NodeRepository`** (blast radius recomputed at notify-time; the server notifier calls it; no raw DB query in the adapter), unit-tested at the boundaries (threshold met, age met, neither) → implement.

## 4. Persistence — Postgres

- [x] 4.1 `pg-backend`: read/write `principal_cursor` + `notification_policy`; the story/digest queries are **bounded (LIMIT/window)**, parameterized, and read the existing event/seq columns. Integration test gated on `WAYPOINT_TEST_DATABASE_URL`.

## 5. Server — re-entry endpoint + notifier (TDD)

- [ ] 5.1 RED: `GET /v1/projects/:id/digest` returns the while-you-were-away payload since the caller's last-seen cursor (**read-only — does not advance the cursor**); `POST /v1/projects/:id/digest/ack` advances the cursor to a given seq (**explicit ack**, consistent with the WS resume cursor) → implement.
- [ ] 5.2 RED: the notifier batches by default and escalates a single push only when blast radius crosses the threshold or an ask ages past the SLA; it never emits one-per-ask → implement. It reads escalation inputs through the `core` use-case (not raw SQL), and ships **one concrete reference transport — a `digest.ready` frame over the existing WebSocket** — behind the `Notifier` port so escalation is end-to-end testable (web-push is a later adapter).
- [ ] 5.3 Failure injection: notifier transport down (no WS subscribers / send throws) → the mutation and durable log are unaffected (best-effort, like the live push); digest still computable from the log. Cursor-write failure after a read is a tolerated double-delivery (documented), never a corruption.

## 6. Web — while-you-were-away + story (TDD, RTL)

- [ ] 6.1 RED: a while-you-were-away panel sits atop the spine on return, summarizing change since last seen, and dismisses (acks the cursor) into the spine → implement.
- [ ] 6.2 RED: the project story is viewable as a threaded narrative; entries link to their node → implement.
- [ ] 6.3 RED: the client handles the `digest.ready` WS frame per the user's cadence/threshold (re-fetch the digest / surface the panel); no policy → silent, digest-on-return only → implement.

## 7. Wiring & verification

- [ ] 7.1 Wire the cursor on visit; demo seed produces a believable overnight story + one high-blast-radius escalation.
- [ ] 7.2 `npm test` green (incl. failure paths); e2e for return-after-away; `openspec validate async-reentry-and-notifications --strict`; update README + docs.
