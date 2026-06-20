# Register-project MCP tool

## Why

A project row can only be created by the SQL seed (`default`). Now that Waypoint runs as a
shared local service that other projects connect to over MCP, every external project is forced
to share the single `default` board — there is no isolation. Agents need a first-class way to
create their own board before parking work, without a human running a seed script.

## What Changes

- A new MCP tool **`register_project`** (`{ projectId, name }`) that creates a project row if
  absent and is **idempotent** — if the id is already registered it returns the existing
  project (`created: false`) rather than erroring. Agents call it once, then pass the id as
  `projectId` to `get_context` / `create_node` / `park_ask`.
- `ProjectRepository` gains an idempotent **`insert(project) → created: boolean`** port method
  (`ON CONFLICT (id) DO NOTHING` in Postgres; map-guarded in the in-memory fake), implemented
  in both adapters so the fake honours the same contract as Postgres (LSP).
- A core use-case **`registerProject`** that builds the project with the injected clock and
  inserts it race-safely (it trusts the insert's `created` flag, not a check-then-insert).
- No event is emitted (project rows carry no event; the audit trail begins with the first
  node), and **no existing tool contract changes** — the change is purely additive.

## Impact

- New MCP tool — an additive contract change (approved by request). The schema is the contract
  (`packages/shared`), validated at the boundary.
- **No DB schema change** (the `project` table already exists) and **no new dependencies**.
- A REST `POST /v1/projects` for UI-driven creation is a deliberate follow-up; this slice is
  the agent-facing MCP tool only.
- The MCP `instructions` bootstrap stays valid; a follow-up can mention `register_project` for
  the multi-project flow.
