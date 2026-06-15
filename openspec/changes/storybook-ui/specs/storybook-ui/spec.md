## ADDED Requirements

### Requirement: Mock data seam

The web app SHALL read all prototype data through a `WaypointSource` interface exposed by a
`WaypointProvider`, never directly from fixtures or the network. The phase-1 implementation SHALL be a
synchronous `mockSource` backed by typed fixtures that faithfully reproduce the design handoff's data
(multiple projects, each with parallel work streams, parked decisions, an activity log, and
notifications). The provider SHALL hold navigation state (current project, view, and open decision) and
the local resolve/comment state, and SHALL persist navigation to `localStorage`. Reading or writing
`localStorage` SHALL be guarded so that corrupt or unavailable storage falls back to an in-memory default
rather than crashing. Screens SHALL depend only on the provider's view-models and callbacks, so the
source can later be replaced by a live backend implementation without changing any screen.

#### Scenario: Screens are source-agnostic

- **WHEN** the data source is the mock implementation
- **THEN** every screen renders from the provider's view-models without referencing fixtures or a network client

#### Scenario: Navigation survives reload

- **WHEN** a human selects a project and view and then reloads
- **THEN** the same project and view are restored from `localStorage`

#### Scenario: Corrupt storage degrades safely

- **WHEN** persisted navigation state is missing or unparseable
- **THEN** the app starts from a safe default view without throwing

### Requirement: Multi-project app shell

The web app SHALL present a persistent shell: a sidebar that switches between projects (each showing a
live/idle indicator and a count of decisions waiting) and offers per-project navigation to the project
map, decisions, activity, settings, and a mobile companion; and a top bar showing the current project and
view, the agent's working/idle status, the time, and a notifications bell with an unread indicator. A
notifications popover SHALL list recent events and navigate to the relevant project, view, or decision
when one is selected.

#### Scenario: Switching projects

- **WHEN** a human selects a different project in the sidebar
- **THEN** the shell shows that project's map and the nav reflects the active project

#### Scenario: A notification navigates to its target

- **WHEN** a human clicks a notification that references a parked decision
- **THEN** the app opens that decision's proposal

### Requirement: Project surfaces

The web app SHALL provide the design's surfaces: a cross-project **home** (a returning-human briefing,
summary statistics, and per-project cards with stream progress); a **project map** of parallel work
streams as connected task nodes with explicit per-node status and a "you are here" marker, where a node
blocked on a decision links to its proposal; a **decision inbox** queue filterable by blocking and
non-blocking, each row showing risk, reversibility, the owning stream, the agent's recommendation, and how
long it has waited; a **proposal detail** showing the question, why it came up, options with tradeoffs and
the agent's recommendation, the impact if deferred, the risk and reversibility, and a comment thread with
the agent; an **activity** timeline grouped over time; a **settings** screen of decision-policy,
notification, and stream toggles; and a **mobile companion** overlay for approving reversible decisions
away from the desk. Every surface SHALL render an explicit empty/edge state (no decisions waiting, an idle
project, a filter matching nothing, or an all-clear companion).

#### Scenario: Returning human re-acquires context on home

- **WHEN** a human opens the app after stepping away
- **THEN** the home shows a briefing of what happened, how many decisions wait, and per-project progress

#### Scenario: A blocked task links to its decision

- **WHEN** a human clicks a task node that is blocked on a parked decision in the project map
- **THEN** the app opens that decision's proposal

#### Scenario: Empty inbox

- **WHEN** a project has no decisions waiting
- **THEN** the inbox shows an explicit "nothing waiting on you" state rather than an empty list

### Requirement: Resolve and comment interactions

The proposal SHALL let a human approve the agent's recommendation, pick a different option, or — for a
non-reversible decision — be told it needs explicit typed confirmation. Resolving a decision SHALL mark it
resolved everywhere it appears (its task node shows it resuming, the inbox and waiting counts drop it) and
SHALL append an agent message that it is applying the choice and resuming the blocked task. Commenting
SHALL append the human's message to the decision thread and an agent acknowledgement, without resolving
the decision.

#### Scenario: Approving a decision resumes its task

- **WHEN** a human approves an option on a proposal
- **THEN** the decision shows as resolved, its task node shows "resuming", and the thread shows the agent applying the choice

#### Scenario: Commenting does not resolve

- **WHEN** a human sends a comment on a proposal
- **THEN** the comment and an agent reply appear in the thread and the decision remains waiting
