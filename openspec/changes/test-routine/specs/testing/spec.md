# testing

## ADDED Requirements

### Requirement: Full-surface walk

The system SHALL provide an automated walk that exercises every externally observable
capability — all MCP tools, all REST routes, and the WebSocket stream — in one ordered
journey against a running stack, asserting the documented contract at each step.

#### Scenario: Every surface exercised

- **WHEN** the walk runs against a freshly seeded stack
- **THEN** it calls each MCP tool (`get_context`, `create_node`, `park_ask`, `transition`),
  reads each REST route (`/healthz`, `/v1/projects`, `/inbox`, `/progress`, `/events`,
  `/answer`), and observes at least one WebSocket `delta` and one `resync`
- **AND** it asserts the node lifecycle (DRAFT→ACTIVE→DONE and →DISCARDED) and the ask
  lifecycle (OPEN→ANSWERED, OPEN→ASSUMED→CONFIRMED, OPEN→ASSUMED→OVERTURNED)
- **AND** it exits non-zero if any assertion fails, printing which surfaces were covered

#### Scenario: Optimistic-concurrency conflict is surfaced

- **WHEN** the walk transitions a node with a stale `expectedVersion`
- **THEN** the call returns `STALE_VERSION` carrying the actual version, and the walk asserts it

#### Scenario: Cross-project isolation

- **WHEN** the walk addresses project A's node or ask id under a different project B
- **THEN** the operation returns `NOT_FOUND` and never leaks or mutates project A's data

#### Scenario: Deterministic assertions

- **WHEN** the walk asserts inbox ordering or the event log
- **THEN** it checks ordering invariants (blast_radius desc; awaited-step order for ties) and
  event-tail semantics, never absolute wall-clock timestamps, so runs are not flaky

### Requirement: Fresh full-stack dev environment

The system SHALL provide a one-command, ephemeral, full-stack environment that starts from a
clean slate, applies migrations, and seeds a deterministic fixture, for on-demand verification
distinct from the dev-only and production compose files.

#### Scenario: Clean slate each start

- **WHEN** `docker-compose.dev.yml` is brought up
- **THEN** Postgres starts on ephemeral (tmpfs) storage, the app applies migrations via its
  existing entrypoint (not a duplicate migrate step), and a deterministic fixture is seeded
  over MCP only after the app reports healthy at `/healthz`

### Requirement: Orchestrated test routine

The system SHALL provide a single entry point that provisions a database, starts the server,
runs the unit/integration suite and the full-surface walk, and tears the environment down,
returning a deterministic pass/fail exit code.

#### Scenario: One-command routine

- **WHEN** `npm run test:routine` is invoked
- **THEN** it provisions a host Postgres, runs `npm test` and `npm run walk`, tears down, and
  exits non-zero if any stage fails

### Requirement: Daily automated run

The system SHALL run the test routine on a daily schedule and report the result, and on
failure SHALL produce a written investigation summary without modifying code.

#### Scenario: Daily pass

- **WHEN** the scheduled routine passes
- **THEN** a concise success notification is emitted

#### Scenario: Daily failure is triaged, not patched

- **WHEN** the scheduled routine fails
- **THEN** the run investigates and records a findings summary (root cause and suspected
  `file:line`) and notifies, and SHALL NOT change source code or open a pull request
