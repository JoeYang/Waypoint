---
paths: ["packages/server/src/db/**", "migrations/**"]
---
# Database Rules (Postgres)

## Migrations
- Migrations are always their own commit — never bundled with feature code.
- Schema changes require review before implementation.
- Never modify a migration after it has been applied to any environment.
- Every migration is reversible — include a down step.
- Name descriptively: `add_index_ask_project_state`, not `migration_007`.

## Schema design
- Every table carries `project_id` (tenant boundary) with a FK + index.
- `node`/`ask` carry an integer `version` for optimistic concurrency; bump on every mutation.
- `event` is append-only with a per-project monotonic `seq` (unique on `(project_id, seq)`); never UPDATE or DELETE an event.
- Index columns used in `WHERE`/`JOIN`/`ORDER BY`: `(project_id, status)`, `(node_id)`, `ask` required+state for the blocked computation.
- `NOT NULL` with explicit defaults over nullable; timestamps in UTC.

## Query discipline
- Parameterized queries only. No N+1 — batch the tree/blast-radius reads.
- Transactions for multi-step atomic ops (answer → ask state → event append → cache invalidate).
- Always bound queries (`LIMIT`/pagination). Statement timeouts set. Test with realistic volumes.

## Connections
- Use a bounded pool sized to expected concurrency; never unbounded. Close connections explicitly in tests.
