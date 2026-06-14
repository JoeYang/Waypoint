## 1. Contracts (interfaces — own commit, before implementation)

- [ ] 1.1 Extend shared schemas: `AskOption` gains optional `consequence` (≤280). `AskSchema` gains `rationale: string | null` (≤2000) and, for a QUESTION, optional `suggestedAnswers: string[]`. Update inferred types so the pg mapper can't silently drop them.
- [ ] 1.2 Extend `park_ask` MCP input: optional `rationale` (capped); `options` accept a backward-compatible union `string | { label, consequence? }` normalized via a zod transform; optional `suggestedAnswers` for QUESTION; optional human-friendly `agentLabel` for provenance. Keep the DECISION≥2 refine on the normalized array.
- [ ] 1.3 Extend the `InboxItem` DTO: add `rationale`, `blocks: { nodeId, title }[]`, `goalTitle: string | null`, `parkedBy: { agentLabel: string, at: number }` (a stable label, never a raw session id), and `suggestedAnswers`.
- [ ] 1.4 Define the answer DTO per intent: a discriminated answer (`chosenOptionId` | `proposalVerdict: approve | adjust | reject` with a capped constraint note on `adjust` | `answerText`), validated and capped at the boundary. An `adjust` is an approval carrying the constraint; the answer result echoes it back.

## 2. Schema (migration — its own commit)

- [x] 2.1 Migration `0002_add_ask_context`: nullable `ask.rationale text`; `ask.suggested_answers jsonb NOT NULL DEFAULT '[]'` (mirrors the domain default); nullable `ask.agent_label text`. Reversible down (drop columns). Per-option consequence rides in the existing `options` jsonb (no DDL). Verified up → down → up against the dev db.

## 3. Core — read model + park (TDD over in-memory fakes)

- [x] 3.1 RED: `parkAsk` accepts and persists `rationale`, per-option `consequence`, `suggestedAnswers`; still enforces DECISION≥2 and non-empty labels → implement.
- [x] 3.2 RED: the inbox read model enriches each item with named blocked tasks (from `depends_on` edges → titles), the ancestor goal (cycle-guarded `parent_id` walk), and provenance — one transaction, no N+1 → implement.
- [x] 3.3 RED: an `agentLabel` is recorded on park; when omitted it resolves to a stable session-derived alias (same session → same alias). An adjusted proposal records one immutable approval event carrying the constraint note → implement.

## 4. Persistence — Postgres

- [x] 4.1 `pg-backend`: persist + read `ask.rationale`, option consequences, suggested answers, `agent_label`; confirm round-trip across transactions. Integration test gated on `WAYPOINT_TEST_DATABASE_URL` (verified green against a throwaway `waypoint_test` db).

## 5. Agent MCP API (TDD)

- [ ] 5.1 RED: `park_ask` accepts the new fields and rejects malformed shapes → implement (thin adapter over core).
- [ ] 5.2 Update `WAYPOINT_INSTRUCTIONS`: direct agents to supply a rationale, a consequence per option, suggested answers for questions, and an `agentLabel` — so the human can answer without typing and the story reads naturally. Assert the guidance is advertised.
- [ ] 5.3 RED: the answer result and `get_context` surface an adjusted proposal's constraint to the agent (so it proceeds under the constraint, not a new round-trip) → implement.

## 6. Web — the decision card (TDD, RTL)

- [ ] 6.1 RED: the card renders rationale ("why this is being asked"), per-option consequence beside each option, the named blocked-work list, the goal, and provenance; backward-safe when fields are absent → implement.
- [ ] 6.2 RED: intent-matched actions — DECISION renders options; PROPOSAL renders Approve / Adjust / Reject with Adjust (only) opening one text field; QUESTION renders suggested answers first with free-text fallback → implement.
- [ ] 6.3 RED: the card is a self-contained unit (no dependence on the flat-list shell), so slice 2 can re-home it unchanged → assert via isolated render.

## 7. Wiring & verification

- [ ] 7.1 Update the demo seed + e2e to supply rationale + per-option consequences + a proposal and a question; manual smoke of a rich card answered with one gesture.
- [ ] 7.2 `npm test` green (incl. failure paths); `openspec validate decision-context-and-actions --strict`; update README + docs for the richer `park_ask` contract.
