## Context

Waypoint is greenfield. The product design (docs/waypoint-design-v3.html, iterated through three reviews incl. two Steve Jobs passes) settled the shape: one smart inbox where agents park forks and keep working, ranked by blast radius. This change implements the thinnest end-to-end slice of that loop. It is cross-cutting (new monorepo, new data model, MCP + REST + WebSocket transports, Postgres) so the technical decisions are recorded here before coding.

Constraints inherited from `.claude/`: TypeScript end-to-end; strict import direction (`core` is transport/harness-neutral); TDD with failure-injection; Postgres; Streamable-HTTP MCP; auth deferred but `project_id` carried everywhere.

## Goals / Non-Goals

**Goals:**
- Prove the core loop: agent `park_ask` → keeps working → human answers → agent unblocks via `get_context`.
- Establish the layered monorepo and the four-table model with the concurrency + computed-field rules.
- Make the inbox feel alive: answering re-ranks the queue over WebSocket.
- Support `depends_on` edges between nodes so `blast_radius` ranking is meaningful — without them the inbox's whole ranking premise collapses.

**Non-Goals:**
- The standalone blocking screen, multi-project UI, GitHub links, decision-record/supersede UI (later changes).
- Cross-harness verification on Codex/OpenCode (the server is harness-neutral by construction; verifying it is a later change).
- Authentication/multi-tenant enforcement (seams only).

## Decisions

### D1 — Ports-and-adapters monorepo (`shared` ← `core` ← `server`; `shared` ← `web`)
The domain `core` declares repository ports and holds all rules; `server` supplies Postgres + transport adapters.
```
  web ──▶ shared          server ──▶ core ──▶ shared
```
- Pro: core is unit-testable with in-memory fakes (no DB); harness/transport-neutral by construction.
- Pro: a 4th harness or a CLI is a new adapter, not a core change (OCP).
- Con: more package boilerplate up front.
- Alternative (single package): rejected — couples domain to pg/transport, makes the multi-harness promise unenforceable.

### D2 — Tables authoritative; event log append-only audit
Mutations write `node`/`ask` rows and append an `event`. Replay/history reads events; current state reads tables.
- Pro: trivial reads ("what's blocked now") with no fold; matches the prior-art backlog tool.
- Con: a mutation could forget to emit an event → enforce single write-path that does both in one transaction.
- Cardinality: one logical mutation = exactly one event. WebSocket deltas are derived projections of that event and MAY cover several affected nodes (one answer can re-rank multiple asks).
- Alternative (event-sourcing, events authoritative): rejected for this slice — replay cost and ambiguity the design review flagged.

### D3 — `blocked` and `blast_radius` computed, materialized, event-invalidated
Semantic source of truth is the formula; a cached value lives on the row and is recomputed by the events that can change it (ask opened/answered, edge added/met).
- Pro: no graph-cascade on every read; WebSocket pushes only rows whose value changed.
- Con: cache-invalidation logic to get right → covered by failure-injection tests.

### D4 — Optimistic concurrency: `expected_version` + per-project `event.seq`
Every mutating tool/endpoint takes `expected_version`; stale writes are rejected with current state. `event.seq` is a per-project monotonic counter giving total history order and WebSocket resume-since-seq.
- Pro: handles concurrent agents + human (incl. the overturn-while-DONE race) without locks.
- Alternative (pessimistic locks): rejected — poor fit for long async human latency.

### D5 — MCP over Streamable HTTP; bootstrap via the `instructions` field
The server advertises "call `get_context` first" in `InitializeResult.instructions`, consumed by any harness. No per-harness file is required for the loop.
- Pro: portable across Claude Code/Codex/OpenCode; HTTP+SSE is deprecated (spec 2025-03-26).
- Risk: not every harness may surface `instructions` to the model → see Risks.

### D6 — REST for mutations, WebSocket for live deltas
Human answers via REST; the server pushes delta events; the inbox re-ranks. No polling.
- Pro: delivers the signature answer→working→re-rank interaction.
- Con: WS lifecycle complexity → covered by `.claude/rules/websocket.md` + tests.

## Risks / Trade-offs

- [Harness ignores MCP `instructions`] → Keep `get_context` idempotent and cheap; reinforce via optional CLAUDE.md/AGENTS.md lines; a half-day spike validates before we depend on it (tracked as an open question).
- [Cache invalidation drift between computed and materialized `blocked`] → A single recompute function is the only writer; property test: materialized value always equals freshly-computed value after any mutation.
- [Event emitted outside the mutation transaction] → All mutations go through one repository write-path that appends the event in the same transaction; test asserts no state change without a corresponding event.
- [Scope creep into the second screen] → Explicitly out of scope; the inbox shows the in-card "blocks N" badge but not the standalone view.

## Migration Plan

Greenfield. First migration creates `project`, `node`, `ask`, `event` (+ indexes, `version`, unique `(project_id, seq)`). Migration is its own commit (per database rules), reversible with a down step. A seed inserts the single default project. Rollback = down migration; no production data yet.

## Open Questions

- Does the MCP `instructions` field reliably reach the model on all three harnesses? (half-day spike before the multi-harness change).
- `blast_radius` (resolved for this slice): direct `depends_on` dependents of the ask's node; transitive closure deferred to a later change.
- Assumption autonomy policy (any ask vs. low-consequence only) — deferred to the change that adds the consequence gate; this slice allows `park_ask` to mark an assumption but does not gate it.
