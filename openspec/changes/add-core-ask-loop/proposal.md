## Why

Coding agents stall whenever they hit a decision a human must make — they either block idle or guess wrong. Waypoint's core loop fixes this: an agent parks the fork, keeps working on everything still unblocked, and the human answers asynchronously. This change builds that loop end-to-end as the thinnest shippable vertical slice, proving the spine (park → keep working → answer → unblock) before the second screen, multi-project, and cross-harness verification are layered on.

## What Changes

- Establish the npm-workspaces monorepo (`shared`, `core`, `server`, `web`) with the strict import-direction layering from `.claude/rules/architecture.md`.
- Introduce the domain model: `project`, `node`, `ask`, `event` — with the node status spine (`DRAFT → ACTIVE → DONE/DISCARDED`) and the ask lifecycle including proceed-on-assumption (`OPEN → ASSUMED → CONFIRMED/OVERTURNED`).
- Support `depends_on` dependency edges between nodes (acyclic, within a project) — they drive blocking and the blast-radius ranking that orders the inbox.
- Compute, never store: `blocked(node)` and `blast_radius(ask)`. Enforce optimistic concurrency via `expected_version` and a per-project monotonic `event.seq`.
- Expose an MCP server over Streamable HTTP with the tools an agent needs for the loop: `get_context`, `create_node`, `park_ask`, `transition`. Advertise the bootstrap via the MCP `instructions` field at `initialize`.
- Ship a minimal web **Inbox** screen: asks ranked by blast radius, a human answers a decision/proposal, and the answered card flips to "working" live over WebSocket as the queue re-ranks.
- Operate on a single seeded project (no project creation/switching UI in this slice).

## Capabilities

### New Capabilities
- `ask-lifecycle`: the domain model and rules — node hierarchy, ask states incl. proceed-on-assumption, computed `blocked`/`blast_radius`, optimistic-concurrency guard, and the append-only event log. Lives in `core` over repository ports, persisted in `server` (Postgres).
- `agent-mcp-api`: the Streamable-HTTP MCP server and its tools (`get_context`, `create_node`, `park_ask`, `transition`), plus the `instructions`-field bootstrap that tells any harness to call `get_context` first.
- `inbox`: the REST + WebSocket API and the minimal React Inbox screen — blast-radius ranking, answering an ask, and the live answer→working→re-rank interaction.

### Modified Capabilities
<!-- none — greenfield project, no existing specs -->

## Impact

- **New code**: monorepo packages `packages/{shared,core,server,web}`; first Postgres migration (`project`, `node`, `ask`, `event`).
- **Dependencies** (require human review before adding): `@modelcontextprotocol/sdk`, `zod`, `pg`, a Node HTTP framework (Fastify), `ws`, `react`, `vite`, `vitest`, `@playwright/test`, `@testing-library/react`, `msw`.
- **Infra**: a Postgres instance (local via Docker for dev). Auth is out of scope; `project_id` is carried on every row as the future tenant boundary.
- **Out of scope (later changes)**: standalone blocking screen, multi-project UI, cross-harness (Codex/OpenCode) verification, GitHub PR/MR links, decision-record/supersede UI, structured design-review rendering.
