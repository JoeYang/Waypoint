---
paths: ["packages/server/src/mcp/**"]
---
# MCP Server Rules

Waypoint is harness-neutral: the same MCP server serves Claude Code, Codex, and OpenCode.

## Transport
- **Streamable HTTP** only (single endpoint). Do NOT use the deprecated HTTP+SSE transport (removed-in-favour-of as of MCP spec 2025-03-26).
- Survive reconnects; stateless per request where possible.

## Bootstrap (the portable part)
- Advertise usage in the `InitializeResult.instructions` field — all three harnesses read it.
  It must tell a fresh session: *call `get_context(project)` first; park forks with `park_ask` instead of guessing.*
- Do not depend on any per-harness file (CLAUDE.md / AGENTS.md / hooks) for the core loop — those are optional reinforcement only.

## Tools
- Tool args/results are zod schemas from `packages/shared`; the schema is the contract.
- Mutations (`park_ask`, `answer`, `transition`, `create_node`) take `expected_version` and return current state on a stale write — never silently overwrite.
- `get_context` returns a compacted, summarized pack — goal, open asks, recent answers/decisions, session-id provenance — never raw event rows (context-window discipline).
- Record the calling session id as provenance on touched nodes (for interactive `--resume`, never headless `-p`).

## Discipline
- MCP handlers are thin adapters over `core` use-cases; no domain logic in the tool layer.
- Validate every tool arg at the boundary; reject unknown project/node ids with a typed error.
