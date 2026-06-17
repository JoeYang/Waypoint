## ADDED Requirements

### Requirement: Project list endpoint

The server SHALL expose `GET /v1/projects` returning a `ProjectListResponse` — a list of
`ProjectSummary` (project id, name, and read-time-derived counts: open asks, agent tasks, last
activity). The endpoint is a read; it performs no mutation and requires no schema migration. It
follows the versioned path and the consistent error envelope, and never leaks internal ids, SQL,
or stack traces.

#### Scenario: List projects with derived counts

- **WHEN** a client calls `GET /v1/projects`
- **THEN** the response lists each project with its id, name, and current open-ask and agent-task counts

#### Scenario: Counts are computed read-time per project

- **WHEN** an ask is parked or answered in a project
- **THEN** a subsequent `GET /v1/projects` reflects the new open-ask count for that project without a projection step

#### Scenario: No projects

- **WHEN** `GET /v1/projects` is called and no projects exist
- **THEN** the response is an empty list, not an error

### Requirement: Project events endpoint

The server SHALL expose `GET /v1/projects/:projectId/events` returning an `EventLogResponse` — the
append-only event log for that project (each entry: verb, ref, actor, summary, at, per-project
seq), optionally filtered by a `sinceSeq` query parameter and bounded to a page. Every query is
scoped by `projectId`; the endpoint never returns events from another project. It is a read over
the immutable event log — no event is created, edited, or deleted.

#### Scenario: Read the project event log

- **WHEN** a client calls `GET /v1/projects/:projectId/events`
- **THEN** the response returns that project's events in append order with their per-project seq

#### Scenario: Incremental read since a sequence

- **WHEN** a client calls `GET /v1/projects/:projectId/events?sinceSeq=N`
- **THEN** only events with seq greater than N are returned

#### Scenario: Tenancy is enforced

- **WHEN** events exist in project A and a client reads project B's events
- **THEN** none of project A's events appear in the response
