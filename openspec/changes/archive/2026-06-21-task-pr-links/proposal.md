## Why

A coding agent often opens a GitHub pull request for the work behind a task, but Waypoint's
progress tree has no way to surface it. The human reviewing the spine cannot jump from a task
to the PR that implements it, so the link lives only in the agent's head or a side channel.

This is the minimal, approved approach (a parked decision answered opt-1): a task node carries
an optional GitHub PR URL, supplied by the agent at `create_node` and surfaced on the task in
the progress tree. There is **no new MCP tool** and **no GitHub API** — just a nullable field
flowing DB → core → wire. The web render is a separate follow-up.

## What Changes

- `create_node` accepts an optional `prUrl` (validated as a URL at the boundary). It is persisted
  on the node and defaults to absent/null when omitted.
- The task entry in the project progress read model surfaces `prUrl` (null when the task has none),
  so a future web render can link a task to its pull request.

## Capabilities

### Modified Capabilities

- `agent-mcp-api`: `create_node` gains an optional `prUrl` input, persisted on the node.
- `project-progress`: a task in the read model reports its `prUrl` (or null).

## Impact

- **Schema**: add a nullable `pr_url text` column to `node` (its own migration, reversible). No
  default — absence is null. Existing rows read back as null.
- **Code**: `shared` adds `prUrl` to the `create_node` input shape and to the node + task-progress
  DTOs; `core` threads `prUrl` through `createNode` and surfaces it in `buildTask`; `server` carries
  `pr_url` in the Postgres node row mapping (INSERT/SELECT). `core` stays driver-free.
- **No new dependencies.** No MCP tool added. No GitHub API call.
- **Web**: untouched here — the render is a follow-up slice.
