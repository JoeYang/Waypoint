## ADDED Requirements

### Requirement: Three-level progress read model

The system SHALL expose a read model that reports the project on three levels — goal, plan, task — each
with explicit state and rolled-up progress, computed from data already stored (node status, ask state,
`depends_on` edges) in a single transaction without an N+1 and with a cycle guard on the hierarchy walk.
A goal SHALL report `on-track | at-risk | blocked`, the percentage of its plans done, and the count of
open asks beneath it. A plan SHALL report `active | blocked | done`, its owning agent, its last activity,
and its rolled-up open asks. A task SHALL report `running | blocked-on-ask | done | failed`, the agent on
it now, and the asks it has spawned. The read model SHALL report each node's blast radius (direct
dependents only) for use as visual weight and SHALL NOT impose a presentation sort order. The rollup
SHALL be computed within an interactive latency budget on a realistic tree; if the read-time computation
exceeds that budget, the implementation SHALL serve a denormalized projection updated on event append
rather than degrade the spine.

#### Scenario: Levels roll up from leaves

- **WHEN** a task is blocked-on-ask
- **THEN** its plan reports `blocked` and the goal reflects the open ask in its count

#### Scenario: Progress aggregates

- **WHEN** some plans under a goal are done and others active
- **THEN** the goal reports the correct percentage of plans done

#### Scenario: One read, no N+1

- **WHEN** the progress read model is requested for a project with many plans and tasks
- **THEN** it is computed in a single transaction without per-node follow-up queries

### Requirement: Project spine view

The web app SHALL present the project spine as the application home: a fixed goal header, plan sections
showing progress, and tasks beneath them, with asks appearing in place on the task they block (using the
self-contained decision card). Importance SHALL be shown as visual weight, never by reordering the list
under the reader. The tree SHALL collapse to the live edge by default to stay glanceable and SHALL be
expandable. On a live update, completed work SHALL settle/dim and only changed items SHALL move; the goal
SHALL remain fixed.

#### Scenario: Returning human sees where things stand

- **WHEN** a human opens the spine
- **THEN** they see the goal, each plan's progress, and the tasks that need them, in one column

#### Scenario: An ask appears on the task it blocks

- **WHEN** a task is blocked by an ask
- **THEN** the ask is rendered in place on that task with its slice-1 context and intent-matched actions

#### Scenario: Importance is weight, not position

- **WHEN** one blocked task has a much larger blast radius than another
- **THEN** it is rendered with greater visual weight without reordering the surrounding tree
