# project-progress Specification

## Purpose
TBD - created by archiving change project-progress-spine. Update Purpose after archive.
## Requirements
### Requirement: Three-level progress read model

The system SHALL expose a read model that reports the project on three levels — goal, plan, task — each
with explicit state and rolled-up progress, computed from data already stored (node status, ask state,
`depends_on` edges) in a single transaction without an N+1 and with a cycle guard on the hierarchy walk.
A goal SHALL report `on-track | at-risk | blocked`, the percentage of its plans done, and the count of
open asks beneath it. A plan SHALL report `active | blocked | done`, its owning agent, its last activity,
and its rolled-up open asks. A task SHALL report `running | blocked-on-ask | done | failed`, the agent on
it now, and the asks it has spawned (its open asks SHALL be carried in `InboxItem` shape so the decision
card hydrates without a second fetch). The read model SHALL report each node's blast radius (direct
dependents only) for use as visual weight and SHALL NOT impose a presentation sort order. The rollup
SHALL be computed within an interactive latency budget on a realistic tree; if the read-time computation
exceeds that budget, the implementation SHALL serve a denormalized projection updated on event append
rather than degrade the spine.

The derived states are defined as: a **task** is `blocked-on-ask` if it has a required OPEN ask, else
`failed` if `DISCARDED` (its `discardReason` being the failure reason), else `done` if `DONE`, else
`running`. A **plan** is `done` if every descendant task is done/closed, `blocked` if any descendant task
is `blocked-on-ask`, else `active`. A **goal** is `blocked` if it has descendant work but none is movable
(every non-done leaf is blocked-on-ask), `at-risk` if at least one descendant is `blocked-on-ask` while
other work is still movable, else `on-track`. A `step` node is a kind-aware nested group between a plan
and its tasks; its tasks roll up through the step into the plan, and no `step` subtree is dropped.

#### Scenario: Levels roll up from leaves

- **WHEN** a task is blocked-on-ask
- **THEN** its plan reports `blocked` and the goal reflects the open ask in its count

#### Scenario: Progress aggregates

- **WHEN** some plans under a goal are done and others active
- **THEN** the goal reports the correct percentage of plans done

#### Scenario: One read, no N+1

- **WHEN** the progress read model is requested for a project with many plans and tasks
- **THEN** it is computed in a single transaction without per-node follow-up queries

