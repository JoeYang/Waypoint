## 1. Contracts (interfaces — own commit, before implementation)

- [ ] 1.1 Extend shared schemas: `AskOption` gains optional `consequence` (≤280 chars). **`AskSchema` gains `rationale: string | null` (≤2000) AND `sessionId: string | null`** — the domain `Ask` type must carry both or the pg mapper silently drops them on read. Update inferred types.
- [ ] 1.2 Extend `park_ask` MCP input: add optional `rationale` (capped). `options` accept a **backward-compatible union** `string | { label, consequence? }`, normalized to `{ label, consequence? }` via a zod transform at the boundary so existing string-only seeds keep working and core sees one shape. Update `parkAskInputShape`, the `ParkAskInputSchema` + DECISION≥2 refine (count works on the normalized array).
- [ ] 1.3 Extend `InboxItem` DTO: add `rationale`, `blocks: { nodeId, title }[]`, `goalTitle: string | null`, and `parkedBy: { sessionId: string | null, at: number }`. (Option consequences arrive via the extended `AskOption`.)
- [ ] 1.4 Add `EventLog.latestSeq(projectId): Promise<number>` port (reads the project seq counter / `MAX(seq)`) so `listInbox` can report the current seq **without loading the full event log**.

## 2. Schema (migration — its own commit)

- [ ] 2.1 Migration `0002_add_ask_context`: add nullable `ask.rationale text` and `ask.session_id text` (both default NULL); reversible down (drop both columns). Consequences ride in the existing `options` jsonb (no DDL). `session_id` makes provenance a direct read — no event scan.

## 3. Core — read model + park (TDD over in-memory fakes)

- [ ] 3.1 RED: `parkAsk` accepts `rationale`, `sessionId`, and per-option `consequence`, persists all, and still enforces DECISION≥2 and non-empty option labels → implement.
- [ ] 3.2 RED: `listInbox` enriches each item with the blocked nodes' titles (from `depends_on` edges → node titles), the goal the node ladders toward (walk `parent_id` to the root goal, with a seen-set/depth-cap cycle guard), and provenance (`ask.sessionId` + `ask.createdAt`). Uses `latestSeq()` for the seq and **no longer loads the full event log** — one transaction, no N+1 → implement.

## 4. Persistence — Postgres

- [ ] 4.1 `pg-backend`: persist + read `ask.rationale` and `ask.session_id`; implement `latestSeq`; confirm option consequences round-trip through the `options` jsonb. Integration test asserting rationale + sessionId + consequence survive a write/read across transactions (gated on `WAYPOINT_TEST_DATABASE_URL`).

## 5. Agent MCP API (TDD)

- [ ] 5.1 RED: `park_ask` tool accepts `rationale` + `{label, consequence}` options, rejects malformed shapes, and records them → implement (thin adapter over core).
- [ ] 5.2 Update `WAYPOINT_INSTRUCTIONS`: direct agents to supply a `rationale` (why the decision is needed) and a `consequence` for each option (what choosing it commits to), not just the prompt. Assert the guidance is advertised.

## 6. Web — the decision card (TDD, RTL)

- [ ] 6.1 RED: `InboxCard` renders the rationale ("why this is being asked"), the blocked-work list, the goal it ladders toward, per-option consequences beside each option, and provenance → implement. Backward-safe when fields are absent (older asks).
- [ ] 6.2 RED: a stakes header (type · blocks-N as a badge · waited) and the node's place in the tree; long rationale is expandable, not truncated silently → implement.
- [ ] 6.3 Animate the answer → removal → re-rank transition (Axiom motion tokens, `prefers-reduced-motion` respected); the reorder is driven by the live delta. Behaviour test for the reorder.

## 7. Wiring & verification

- [ ] 7.1 Update the dogfood + demo seeds and the e2e to supply rationale + per-option consequences; manual smoke of a rich card end-to-end.
- [ ] 7.2 `npm test` green (incl. failure paths); `openspec validate enrich-decision-context --strict`; update README + docs for the richer `park_ask` contract.
