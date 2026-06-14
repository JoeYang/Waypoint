## 1. Contracts (interfaces — own commit, before implementation)

- [ ] 1.1 Define the `StoryEntry` DTO (a node-threaded, human-legible projection of an event: actor, verb, target node, summary, seq, at) and the `Digest` DTO (since-last-seen: shipped, newly-blocked, waiting — rolled up across the three levels). Infer from zod.
- [ ] 1.2 Define the notification contract: a `NotificationPolicy` (cadence, blast-radius threshold, age SLA — all user-set) and the escalation decision input (ask blast radius + age + count of waiting asks). Transport-agnostic.

## 2. Schema (migration — its own commit)

- [ ] 2.1 Migration: add a per-principal `last_seen_seq` read cursor (nullable). Reversible down. The event log is untouched (append-only). Pre-auth, the cursor keys on a well-known default principal via the `principal` seam (mirroring `DEFAULT_PROJECT_ID`).

## 3. Core — projections (TDD over in-memory fakes)

- [ ] 3.1 RED: `story(projectId, sinceSeq)` projects the event log into node-threaded narrative entries, oldest-first, with no source mutation → implement.
- [ ] 3.2 RED: `digest(projectId, lastSeenSeq)` summarizes since the cursor — what shipped, what is newly blocked, what is waiting — rolled up across goal/plan/task → implement.
- [ ] 3.3 RED: the escalation decision — given a policy and an ask's blast radius + age, decide push-now vs. batch — is a pure `core` use-case (the server notifier calls it; no raw DB query in the adapter), unit-tested at the boundaries (threshold met, age met, neither) → implement.

## 4. Persistence — Postgres

- [ ] 4.1 `pg-backend`: read/write `last_seen_seq`; the story/digest queries are bounded, parameterized, and read the existing event/seq columns. Integration test gated on `WAYPOINT_TEST_DATABASE_URL`.

## 5. Server — re-entry endpoint + notifier (TDD)

- [ ] 5.1 RED: `GET /v1/projects/:id/digest` returns the while-you-were-away payload since the caller's last-seen cursor; updates the cursor on read or via an explicit ack → implement.
- [ ] 5.2 RED: the notifier batches by default and escalates a single push only when blast radius crosses the threshold or an ask ages past the SLA; it never emits one-per-ask → implement. It reads escalation inputs through the `core` use-case (not raw SQL), and ships **one concrete reference transport** (web push) behind the port so escalation is end-to-end testable.
- [ ] 5.3 Failure injection: notifier transport down → the mutation and durable log are unaffected (best-effort, like the live push); digest still computable from the log.

## 6. Web — while-you-were-away + push (TDD, RTL)

- [ ] 6.1 RED: a while-you-were-away panel sits atop the spine on return, summarizing change since last seen, and dismisses into the spine → implement.
- [ ] 6.2 RED: the project story is viewable as a threaded narrative; entries link to their node → implement.
- [ ] 6.3 RED: opt-in push subscription respects the user's cadence/threshold; no subscription → silent, digest-on-return only → implement.

## 7. Wiring & verification

- [ ] 7.1 Wire the cursor on visit; demo seed produces a believable overnight story + one high-blast-radius escalation.
- [ ] 7.2 `npm test` green (incl. failure paths); e2e for return-after-away; `openspec validate async-reentry-and-notifications --strict`; update README + docs.
