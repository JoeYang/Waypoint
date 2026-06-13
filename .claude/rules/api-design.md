---
paths: ["packages/server/src/mcp/**", "packages/server/src/rest/**", "packages/server/src/routes/**", "packages/server/src/handlers/**"]
---
# API Design Rules

## REST conventions
- RESTful resource naming, all paths versioned: `GET /v1/projects/:id/inbox`, `POST /v1/asks/:id/answer`.
- Consistent error envelope on every endpoint:
  ```json
  {"error": "STALE_VERSION", "message": "node was modified", "request_id": "..."}
  ```
- Include `X-Request-ID` on all responses for tracing.
- Validate all input at the boundary with **zod**; infer types from the schema.
- Never expose internal ids, stack traces, or SQL in error responses.

## MCP tool contracts
- Tool args and results are zod schemas shared from `packages/shared` — the wire contract is the type.
- Mutating tools (`park_ask`, `answer`, `transition`) require `expected_version`; return the current state on a stale write rather than throwing.
- `get_context` returns a compacted pack (goal, open asks, recent answers, session provenance), never raw event rows.
- The server advertises usage via the MCP `instructions` field at `initialize` (see mcp-server.md).

## General
- Idempotency: `PUT`/`DELETE` idempotent; idempotency keys for `POST` where a retry could duplicate.
- Cursor-based pagination (by `event.seq` / created-at), never offset.
- Auth checks on every protected route once auth lands — verify identity and project membership.
