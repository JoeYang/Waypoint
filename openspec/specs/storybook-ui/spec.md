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

### Requirement: Project map folds completed plan lanes by default

The project map SHALL render each stream (plan) as a lane whose header is an accessible
toggle control. The header SHALL be a real `<button>` exposing its expanded/collapsed
state via `aria-expanded`, fully keyboard operable, and meeting WCAG AA contrast. A lane
whose stream status is `done` SHALL start collapsed; a lane with any other status
(`active`, `blocked`, `queued`) SHALL start expanded. When a lane is collapsed its task
nodes SHALL NOT be rendered, while the lane name, status badge, and the `N/N done`
progress summary SHALL remain visible. Activating a lane header SHALL toggle that lane's
expanded state independently of the other lanes.

#### Scenario: Completed lane starts collapsed

- **WHEN** the project map renders a stream whose status is `done`
- **THEN** that lane's task nodes are not visible, but its header, badge, and progress summary remain visible, and its header reports `aria-expanded="false"`

#### Scenario: Expanding a collapsed lane reveals its tasks

- **WHEN** a human activates the header of a collapsed done lane
- **THEN** the lane's task nodes become visible and its header reports `aria-expanded="true"`

#### Scenario: In-progress lane starts expanded

- **WHEN** the project map renders a stream whose status is not `done` (for example `active` or `blocked`)
- **THEN** that lane's task nodes are visible by default and its header reports `aria-expanded="true"`

### Requirement: Project-map spine rail

The project map SHALL render each work stream as a connected **rail**: every task occupies a row
with a left rail cell — a vertical connector line plus a round status-node marker — and a right
content cell holding the task name and meta. The status-node marker SHALL reflect the task status:
a done task SHALL show a filled node with a check glyph; an active task SHALL show a glowing accent
node with a halo/pulse ring, the most emphasised node on the lane; a task blocked on a decision
SHALL show a hollow node with an amber ring; a queued task SHALL show a hollow, faint node, and the
connector segment above it SHALL be dashed ("future") while all other segments are solid. The
status-node markers SHALL be decorative (hidden from assistive technology); the task name SHALL
carry the meaning. A task that is the "you are here" position SHALL show a "You are here" label
anchored to its glowing node. A task blocked on an unresolved decision SHALL remain the only
interactive node — a button whose accessible name is the task name and which opens that decision's
proposal; once the decision is resolved the node SHALL flip to active and show a "resuming"
treatment instead of being interactive.

#### Scenario: The rail shows per-status nodes

- **WHEN** a lane contains done, active, blocked, and queued tasks
- **THEN** each task renders on the rail with a status-node marker matching its status, and the
  connector above a queued task is drawn as a dashed (future) segment

#### Scenario: The you-are-here node is emphasised

- **WHEN** a task is the "you are here" position
- **THEN** its node is the glowing/pulsing active node and a "You are here" label is shown beside it

#### Scenario: A blocked node opens its proposal

- **WHEN** a human activates a task blocked on an unresolved decision
- **THEN** the app opens that decision's proposal, and a resolved blocked task instead shows the
  resuming treatment and is no longer interactive

### Requirement: Inline-actionable parked map node

A task on the project map that is blocked on an unresolved decision SHALL render as an
inline-actionable parked row rather than a plain "Decision parked" badge. The row SHALL surface the
parked decision's question and SHALL present a clear "Review" affordance (label plus a forward
arrow) signalling that activating the node opens that decision's proposal. The node SHALL remain a
single interactive control whose accessible name includes the decision question and which is fully
keyboard-operable; activating it SHALL open the decision's proposal. When no decision is supplied
for the parked task, the row SHALL fall back to a plain "Decision parked" label. A parked decision
whose risk is high SHALL be visually marked (a risk accent) so it stands out while scanning the map.

#### Scenario: A parked node shows the decision question and a Review action

- **WHEN** a task is blocked on an unresolved decision whose question is known
- **THEN** the node shows that question text and a "Review" affordance, and activating the node
  opens that decision's proposal

#### Scenario: A high-risk parked decision is visually marked

- **WHEN** a parked task's decision has high risk
- **THEN** the node shows a high-risk accent so it stands out from lower-risk parked nodes

#### Scenario: A parked node falls back to a plain label without a decision

- **WHEN** a task is blocked but no decision detail is supplied to the node
- **THEN** the node shows a plain "Decision parked" label and remains interactive

### Requirement: Project-map lane progress + summary

The project map SHALL make stream progress legible at a glance. Each stream lane header SHALL
carry a progress meter — a horizontal bar whose fill reflects the fraction of the stream's tasks
that are done — exposed to assistive technology as a progress indicator with its current value,
minimum, and maximum, and labelled by the stream name. When a lane is collapsed AND complete (its
status is done, or all of its tasks are done), its header SHALL additionally show a one-line "all
green" summary (a check glyph plus the done/total count) so the collapsed lane still reads as
complete; collapsed lanes that are not complete SHALL keep the standard header.

The map SHALL show a summary strip beneath the title and legend with three figures derived from
the project's streams: the number of streams, the number of live edits (tasks currently active
across all streams), and the number of parked items (tasks blocked on a decision across all
streams). The strip SHALL offer a "Jump to where you left off" control when a "you are here" task
exists; activating it SHALL ensure that task's lane is expanded and bring the task into view. When
no "you are here" task exists the control SHALL be absent.

#### Scenario: A lane header carries a progress meter

- **WHEN** a stream lane is rendered
- **THEN** its header shows a progress meter exposed as a progress indicator whose current value
  equals the stream's done-task count and whose maximum equals the stream's total task count

#### Scenario: A collapsed done lane reads as complete

- **WHEN** a stream is complete and its lane is collapsed
- **THEN** the header shows an "all green" summary with the done/total count alongside a check glyph

#### Scenario: The summary strip counts streams, live edits, and parked items

- **WHEN** the map is rendered for a project
- **THEN** the summary strip shows the number of streams, the count of active tasks as live edits,
  and the count of blocked tasks as parked items

#### Scenario: Jump to where you left off expands the target lane

- **WHEN** a "you are here" task exists in a collapsed lane and the human activates "Jump to where
  you left off"
- **THEN** that task's lane is expanded so the task is brought into view

### Requirement: Home needs-you command bar

The cross-project home landing SHALL spend its hierarchy on the decisions waiting on the human. It
SHALL surface the actual parked decisions across all projects at the top with a per-decision review
action, emphasise a single "waiting on you" count while demoting the other activity metrics to a
quiet inline strip, and present each project card with where its agent is now plus a parked accent
and one segmented progress meter — driven entirely by the existing projects data snapshot (no new
contract or schema).

- The home SHALL render a needs-you command bar at the top carrying one emphasised numeral of the
  total open (unresolved) decisions across all projects labelled "waiting on you" beside a greeting,
  then a list of the actual parked decisions — each row showing the decision title, its project name,
  how long it has been parked, and a review action that navigates to that decision and opens it.
  When there are no open decisions the bar SHALL render an all-caught-up state instead of the list.
- The home SHALL demote the other activity metrics (agents working, tasks in flight, active streams)
  into a single quiet inline strip derived from the data, present but not competing with the
  needs-you count.
- Each project card SHALL render a "now" line naming the project's current task (the task marked as
  here, else the first active task; omitted when there is none), a parked accent on cards that have
  at least one open decision, and a single segmented progress meter (done / active / parked) with a
  count label computed from the project's tasks across its streams — keeping the project glyph, name,
  agent pill, and the decision/caught-up badge.

#### Scenario: Home surfaces the actual parked decisions with a review action

- **WHEN** the home renders with projects that have open parked decisions
- **THEN** the needs-you command bar lists each actual decision with its title, project name, and
  parked age, and activating a decision's review action navigates to that decision and opens it

#### Scenario: One waiting count is emphasised and the other metrics are demoted

- **WHEN** the home renders
- **THEN** a single emphasised count of decisions waiting on the human is shown, and the other
  metrics (agents working, tasks in flight, active streams) appear only in a quiet inline strip

#### Scenario: Each project card shows where its agent is now with a parked accent

- **WHEN** the home renders a project that has a current task and an open decision
- **THEN** that project's card shows a "now" line naming the current task, a single segmented
  progress meter with a count label, and a parked accent marking that the card has a waiting decision

### Requirement: Resolve confirmation toast

The UI SHALL surface a transient, non-modal confirmation toast when a human answers a parked
decision (approving the recommended option, applying another option, or sending a redirecting
constraint), confirming the action landed and the agent is resuming, in addition to flipping the
decision card to its resolved state. The toast SHALL be presented in a polite live region so
assistive technology
announces it without stealing focus, SHALL auto-dismiss after a short delay, and SHALL offer a
manual dismiss control. The confirmation SHALL NOT alter the resolve or adjust semantics — it is
enqueued alongside the existing action.

#### Scenario: Toast confirms an applied option

- **WHEN** a human approves or applies an option on a decision surface
- **THEN** a confirmation toast naming the applied option and that the agent is resuming appears in
  the polite live region

#### Scenario: Toast confirms a sent adjustment

- **WHEN** a human sends a redirecting constraint via the Send & apply path
- **THEN** a confirmation toast that the adjustment was sent and the agent is resuming appears

#### Scenario: A toast auto-dismisses and can be dismissed manually

- **WHEN** a confirmation toast has been shown
- **THEN** it is removed automatically after its timeout elapses, and a human can also remove it
  immediately via its dismiss control

### Requirement: Skeleton loading states

Async and live views SHALL render a low-fidelity skeleton placeholder while their data is loading,
instead of a bare line of loading text, so that the layout is anchored before content arrives and the
content swap is calm rather than an abrupt snap. A reusable presentational `Skeleton` component SHALL
provide the shimmer placeholder: it SHALL support a single block or `N` stacked line bars, accept
caller-supplied width, height, and corner radius, be marked decorative (`aria-hidden`) so it
contributes nothing to the accessibility tree, and SHALL disable its shimmer animation under
`prefers-reduced-motion`.

Every loading state that adopts skeletons SHALL preserve an accessible loading signal: the skeleton
SHALL be wrapped in an element exposing `role="status"` and an accessible "Loading…" name (via
visually-hidden text and/or `aria-busy`), so assistive technology still announces the loading state
and the state remains programmatically assertable. The provider's pre-content loading branch SHALL
render an app-shell skeleton (approximating sidebar + content), and each re-entry surface
(briefing, mission control, timeline) SHALL render skeleton rows in place of its loading text.

#### Scenario: Skeleton is decorative and supports stacked lines

- **WHEN** a `Skeleton` is rendered with a `lines` count
- **THEN** it renders that many line placeholders and the whole placeholder is hidden from the
  accessibility tree (`aria-hidden`), contributing no accessible name

#### Scenario: Provider loading branch shows a skeleton with a preserved accessible signal

- **WHEN** the provider is in its loading branch (an async load is in flight)
- **THEN** it renders skeleton placeholders AND exposes a `role="status"` region with an accessible
  "Loading…" name, so the loading state is announced and assertable

#### Scenario: Shimmer respects reduced-motion

- **WHEN** the user prefers reduced motion
- **THEN** the skeleton's shimmer animation is disabled while the placeholder still renders

### Requirement: Consistent visual decision signals

The decision surfaces SHALL present four visual signals consistently, driven only by data already
present in each view (decision risk, the recommended option, and whether a decision is new since
the human last left).

Clickable decision rows — the inbox queue rows and the home command-bar decision rows — SHALL
carry a hover affordance that signals the row opens something: a subtle lift and a chevron that
moves on hover. The recommended option SHALL be visually louder than its alternatives in both the
proposal option cards and the inline card's review chips — a faint accent wash and accent border,
in addition to its existing recommendation label — so it wins the glance. A decision that is new
since the human last left SHALL carry an accent ring on the inline card it is shown on, beyond its
text badge. A high-risk decision SHALL read as high-risk consistently: in addition to the map node
and inline card that already colour it, the inbox row SHALL carry a red edge and the proposal
header/container SHALL carry a high-risk red accent.

All hover and movement transitions SHALL respect a reduced-motion preference. These signals are
presentational only and SHALL NOT change any decision behaviour, and SHALL NOT introduce any new
data flow into views that do not already carry the underlying field.

#### Scenario: Clickable decision rows show a hover affordance

- **WHEN** an inbox queue row or a home command-bar decision row is rendered
- **THEN** the row carries a chevron affordance that moves on hover, signalling that the row opens
  the decision

#### Scenario: The recommended option wins the glance

- **WHEN** a proposal's option cards or the inline card's review chips are rendered
- **THEN** the option the agent recommends carries an accent wash distinct from its alternatives,
  in addition to its recommendation label

#### Scenario: A high-risk decision reads as high-risk in the inbox and the proposal

- **WHEN** a decision whose risk is high is shown as an inbox row and as a proposal
- **THEN** the inbox row carries a high-risk red edge and the proposal header/container carries a
  high-risk red accent, matching the map node and inline card

#### Scenario: A decision new since you left carries an accent ring

- **WHEN** an inline decision card is shown for a decision that is new since the human last left
- **THEN** the card carries an accent ring in addition to its "new" text badge

