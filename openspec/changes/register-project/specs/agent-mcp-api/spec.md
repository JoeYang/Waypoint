# agent-mcp-api

## ADDED Requirements

### Requirement: Register a project

The system SHALL expose an MCP tool that creates a project (an isolated board) so an agent can
park work under its own `projectId` instead of sharing a single default board. The operation
SHALL be idempotent.

#### Scenario: Create a new project

- **WHEN** an agent calls `register_project` with a `projectId` and `name` not yet registered
- **THEN** the project is created and the tool returns its `id`, `name`, and `created: true`
- **AND** the agent can immediately use that `projectId` in `get_context` / `create_node` / `park_ask`

#### Scenario: Re-registering is idempotent

- **WHEN** an agent calls `register_project` with a `projectId` that already exists
- **THEN** the existing project is returned with `created: false` and is not overwritten

#### Scenario: Invalid identifiers are rejected at the boundary

- **WHEN** `register_project` is called with an empty/oversized `name` or a `projectId` that is
  not a valid slug
- **THEN** the call is rejected with a validation error and no project is created
