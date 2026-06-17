# storybook-ui Specification

## Purpose
TBD - created by archiving change storybook-ui. Update Purpose after archive.
## Requirements
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

### Requirement: The web data source resolves live backend data

The `WaypointSource` seam SHALL support a live implementation that draws from the backend: the
project map from `GET /v1/projects/:id/progress`, the decision inbox from `GET /v1/projects/:id/inbox`,
the activity timeline from `GET /v1/projects/:id/events`, and the cross-project home from
`GET /v1/projects`. The live source SHALL map backend DTOs to the existing view-model so no screen
changes; presentational fields with no backend equivalent (glyph, colour, description) resolve from
a web config keyed by project id, with a deterministic fallback. The mock source remains a valid
implementation of the same seam.

#### Scenario: Screens render live data through the unchanged seam

- **WHEN** the app is configured with the live source and a project has progress, asks, and events
- **THEN** the map, inbox, proposal, and activity screens render that live data with no change to the screen components

#### Scenario: Mock source still satisfies the seam

- **WHEN** the app is configured with the mock source
- **THEN** every screen renders the fixtures exactly as before

#### Scenario: Missing presentational config falls back

- **WHEN** a live project has no configured glyph/colour/description
- **THEN** the UI shows a deterministic generated glyph and colour rather than a blank or an error

### Requirement: Asynchronous load with loading, error, and empty states

The source SHALL load asynchronously, and every async surface SHALL render a loading state, an
error state with a retry action, and an empty state — never a blank screen. The retry re-invokes
the load.

#### Scenario: Loading then content

- **WHEN** a screen mounts while the live load is in flight
- **THEN** a loading state shows until the data resolves, then the content renders

#### Scenario: Backend unavailable

- **WHEN** the live load fails (timeout or connection refused)
- **THEN** an error state with a retry is shown, and activating retry re-attempts the load

#### Scenario: Empty project

- **WHEN** a live project has no parked decisions
- **THEN** the inbox shows its all-caught-up empty state, not a blank or an error

### Requirement: Answers are sent to the backend with optimistic concurrency

Resolving a decision SHALL POST to the answer endpoint carrying the ask's expected version; the
live WebSocket delta is the source of truth that removes the card. A stale-version response SHALL
reconcile (refetch and inform the human) rather than overwrite a concurrent answer. A comment on a
PROPOSAL ask SHALL be sent as an "adjust" verdict with an adjustment note; for non-PROPOSAL asks
the composer is hidden and the thread renders read-only.

#### Scenario: Resolve answers the ask and the card leaves on the live delta

- **WHEN** the human resolves a decision
- **THEN** the answer is posted with the expected version, and the card is removed when the WebSocket delta for that ask arrives

#### Scenario: Stale version reconciles without a lost write

- **WHEN** the ask was already answered (by another human or an agent assumption) and the human resolves with a now-stale version
- **THEN** the answer is rejected as stale, the source refetches, and the human is told it was already answered — no write is lost or clobbered

#### Scenario: A PROPOSAL comment becomes an adjustment

- **WHEN** the human sends a comment on a PROPOSAL ask
- **THEN** it is sent as an approve-with-adjustment carrying the note, which surfaces back to the agent

### Requirement: Live updates arrive over the WebSocket without polling

The inbox SHALL re-rank on a WebSocket delta and recover from a dropped connection via
resume-since-seq, refetching on a sequence-gap resync. The UI SHALL NOT poll.

#### Scenario: A newly parked ask appears live

- **WHEN** an agent parks an ask over MCP while the human is viewing the inbox
- **THEN** the new card appears via a WebSocket delta, ranked by blast radius, without a reload

#### Scenario: Reconnect and resync after a drop

- **WHEN** the WebSocket connection drops and reconnects with a sequence gap
- **THEN** the client resumes since its last seq and refetches on resync so no delta is silently missed

