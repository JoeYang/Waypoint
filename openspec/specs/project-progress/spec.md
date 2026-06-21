# project-progress Specification

## Purpose
TBD - created by archiving change project-progress-spine. Update Purpose after archive.
## Requirements
### Requirement: Three-level progress read model

The system SHALL expose a read model that reports the project on three levels — goal, plan, task — each
with its derived state, the agent attributed to it, its blast radius, and its rolled-up open asks. A task
SHALL report `running | blocked-on-ask | done | failed`, the agent on it, and its open asks. A task SHALL
also report its `prUrl` — the GitHub pull request URL supplied at `create_node`, or null when the task has
none — so a returning human can link a task to the pull request implementing it.

#### Scenario: A task surfaces its PR URL

- **WHEN** a task node was created with a `prUrl`
- **THEN** the task entry in the progress read model reports that `prUrl`

#### Scenario: A task with no PR URL reports null

- **WHEN** a task node was created without a `prUrl`
- **THEN** the task entry in the progress read model reports `prUrl` as null

