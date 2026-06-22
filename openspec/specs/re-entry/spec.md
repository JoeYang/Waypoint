# re-entry Specification

## Purpose
TBD - created by archiving change async-reentry-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: While-you-were-away digest

The system SHALL provide a digest, computed from the append-only event log since the human's last-seen
seq, that summarizes what shipped, what is newly blocked, and what is waiting on the human — rolled up
across the goal, plan, and task levels. The digest SHALL be a projection only; it SHALL NOT mutate the
event log. The last-seen cursor SHALL advance on visit (read or explicit acknowledgement) so the next
digest covers only new change.

#### Scenario: Returning human sees what changed since last visit

- **WHEN** a human returns after being away and events have accrued since their last-seen seq
- **THEN** the digest lists what shipped, what is newly blocked, and what is waiting on them

#### Scenario: Nothing changed

- **WHEN** no events have accrued since the last-seen seq
- **THEN** the digest is empty rather than fabricated

### Requirement: Project story

The system SHALL project the immutable event log into a human-legible narrative threaded to each event's
node — who did what, to which task, in sequence — so the human can trust what the agents did while
unsupervised. The story SHALL be derived from existing events without editing or deleting any event, and
each entry SHALL reference its node and carry its seq.

#### Scenario: The day reads as a story

- **WHEN** decisions, proposals, and transitions occurred over a period
- **THEN** the story presents them in order, each attributed to an actor and threaded to its node

#### Scenario: The story never rewrites history

- **WHEN** the story is rendered
- **THEN** it reflects the append-only events verbatim in projection, with no event edited or removed

### Requirement: Enriched digest signals

The while-you-were-away digest SHALL carry, in addition to what shipped / newly blocked / waiting,
the signal a returning human needs to triage at a glance — all derived as a projection over the
existing event log and the per-principal last-seen cursor, never stored and never mutating the log:

- Each waiting decision SHALL carry its agent-declared **risk** and **reversibility**, and an
  **isNew** flag that is true exactly when the decision was parked within the unseen window
  (its parking event's seq is greater than the caller's last-seen seq).
- The digest SHALL list **active work** — the tasks an agent is working on now, identified as the
  tasks that are active and not blocked on a required open ask. Active work SHALL name the task
  (and its parent stream), not a file location, because the system holds no agent file-position
  signal.
- The digest SHALL list **heads-up** items — the open asks that need a careful eye, restricted to
  those that are irreversible or high-risk, marked danger when irreversible and warning otherwise.
- The digest SHALL carry **tallies** of task nodes by state (done, active, parked, queued) for a
  progress summary, excluding discarded nodes.

#### Scenario: A waiting decision parked since the last visit is marked new

- **WHEN** a decision was parked after the caller's last-seen seq and is still open
- **THEN** its digest row is marked new, and carries the agent-declared risk and reversibility

#### Scenario: A decision parked before the last visit is not marked new

- **WHEN** a decision was parked at or before the caller's last-seen seq and is still open
- **THEN** its digest row is present in the waiting list but is not marked new

#### Scenario: Active work names the current tasks, not files

- **WHEN** tasks are active and not blocked on a required open ask
- **THEN** the digest lists them as active work with their stream, and never a file path

#### Scenario: Heads-up surfaces only irreversible or high-risk open asks

- **WHEN** open asks exist with varying risk and reversibility
- **THEN** the heads-up list contains exactly the irreversible or high-risk ones, irreversible
  marked danger and the rest warning

#### Scenario: Tallies count task states and exclude discarded

- **WHEN** the project has tasks across done, active, parked, queued, and discarded states
- **THEN** the tallies count the first four by state and exclude discarded

### Requirement: Inline decision act-card

A returning human SHALL be able to act on a parked decision inline — from within a briefing, without
navigating to a separate decision page. The inline card SHALL let the human approve the agent's
recommended option in a single action, or expand to choose a different option and optionally attach
a redirecting constraint. Attaching a constraint SHALL be treated as an approval carrying that
constraint (not a discussion turn). Once acted on, the card SHALL show a terminal resolved state
indicating the agent is applying the choice and resuming the blocked work.

#### Scenario: Approve the recommendation inline

- **WHEN** a human approves the recommended option on an inline decision card
- **THEN** the decision resolves to that option and the card shows the resolved state, the agent
  resuming the blocked work

#### Scenario: Review and redirect with a constraint

- **WHEN** a human expands the card, selects an option, enters a constraint, and applies
- **THEN** the decision is approved carrying the constraint, and the card shows the resolved state

#### Scenario: A decision parked since the last visit is flagged new

- **WHEN** an inline card shows a decision that was parked since the viewer's last visit
- **THEN** the card marks it new

### Requirement: Re-entry briefing surface

The web app SHALL provide a re-entry **briefing** surface: a centered modal dialog that catches a
returning human up on a single project from the enriched while-you-were-away digest and the project
story, read through the existing data seam (no new contract or schema). The briefing SHALL be
driven by a shared re-entry data hook that maps the digest + story + the project's open decisions
into a surface-ready model and exposes a loading / error / ready state, so the other re-entry
surfaces can reuse the same hook unchanged.

- The hook SHALL fetch the digest and story for the given project on mount and expose a
  discriminated state: **loading** while either request is pending, **error** (with a retry action)
  when the digest or story request rejects, and **ready** with the mapped model otherwise.
- The ready model SHALL carry a greeting (the project name and the viewer's name), the project's
  open decisions as **needs-you** items, where the agent is working now (**active work**), what
  **moved** (shipped), the **heads-up** items, the task **tallies**, and the digest **seq** for
  acknowledgement. A needs-you decision SHALL be marked **new** exactly when a waiting digest entry
  with the same ask id is itself new.
- The briefing SHALL render the greeting with a count of decisions needing the human, an inline
  actionable decision card for each needs-you item (or an all-clear line when there are none), the
  active-work and moved summaries, and the heads-up items with danger/warning emphasis. Its primary
  action SHALL acknowledge the digest read cursor at the model's seq and then close the surface.
- The briefing SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Briefing leads with the decisions that need the human

- **WHEN** the digest and story resolve for a project that has open decisions
- **THEN** the briefing shows a greeting counting the decisions needing the human and renders an
  actionable decision card for each open decision, followed by the active-work, moved, and heads-up
  summaries

#### Scenario: A waiting decision new since the last visit is flagged in the briefing

- **WHEN** a project decision matches a waiting digest entry (same ask id) that is marked new
- **THEN** the corresponding needs-you item in the model is marked new

#### Scenario: The briefing acknowledges the cursor when the human jumps in

- **WHEN** the human activates the briefing's primary "jump into the session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: The briefing degrades gracefully when the data fails

- **WHEN** the digest or story request rejects
- **THEN** the briefing shows an error message with a retry action rather than a blank surface

### Requirement: Re-entry mission-control surface

The web app SHALL provide a re-entry **mission-control** surface: a full-screen takeover dialog
that catches a returning human up on a single project, presenting the whole picture at once. It
SHALL be driven by the same shared re-entry data hook as the briefing (no new contract or schema),
embedding the same actionable decision card per open decision so the act surface is identical
across re-entry modes.

- The surface SHALL render as a full-screen takeover dialog labelled "While you were away" with a
  top bar carrying a greeting (the viewer's name and the project name) and a "skip to session"
  action that closes the surface without acknowledging the cursor.
- The body SHALL present three columns: a **needs-you** column with an actionable decision card per
  open decision (or an all-clear line when there are none) and a heads-up sub-section styling each
  item danger or warning; a **where-things-stand** column listing active work as
  "{stream} — {task}" lines and a streams mini-list whose per-stream progress is derived from the
  live project snapshot (done tasks over total tasks); and a **while-you-were-away** column showing
  the moved (shipped) items as a feed.
- The surface SHALL render a footer stat strip summarizing the counts (decisions needing the human,
  active agents, items shipped while away, items to check) and a primary "enter session" action
  that acknowledges the digest read cursor at the model's seq and then closes the surface.
- The surface SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Mission control presents the three-column command deck

- **WHEN** the digest resolves for a project that has open decisions and active work
- **THEN** the surface renders an actionable decision card for each open decision, an active-work
  "{stream} — {task}" line, a per-stream progress row, and the moved feed

#### Scenario: Mission control acknowledges the cursor when the human enters the session

- **WHEN** the human activates the surface's primary "enter session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: Mission control degrades gracefully when the data fails

- **WHEN** the digest request rejects
- **THEN** the surface shows an error message with a retry action rather than a blank surface

### Requirement: Re-entry timeline surface

The web app SHALL provide a re-entry **timeline** surface: a right-side drawer dialog that replays,
for a returning human on a single project, what happened while they were away as a chronological
feed — the project story read back as "who did what, to which node", oldest-first. It SHALL be
driven by the same shared re-entry data hook as the briefing and mission-control surfaces (no new
contract or schema), embedding the same actionable decision card per open decision so the act
surface is identical across re-entry modes.

- The surface SHALL render as a right-side drawer dialog labelled "While you were away" with a
  pinned header section "Needs you · {count}" carrying an actionable decision card per open decision
  (or an all-clear line when there are none).
- The surface SHALL render a "session replay" list of the project story entries, oldest-first, each
  entry showing a time-of-day label derived from the entry's timestamp, a label taken from the
  entry's summary (falling back to its verb), the node title, and the resolved actor label when one
  is present.
- The surface SHALL mark the "new since you left" boundary by rendering a divider immediately before
  the first story entry whose sequence is greater than the digest's last-seen cursor (`sinceSeq`).
  When the cursor is zero (never visited) so every entry is new, the divider SHALL sit at the top of
  the list; when no entry is newer than the cursor, no divider SHALL be rendered.
- The surface SHALL render a primary "enter session" action that acknowledges the digest read cursor
  at the model's seq and then closes the surface.
- The surface SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Timeline replays the session oldest-first with the needs-you cards pinned

- **WHEN** the digest and story resolve for a project that has open decisions and story entries
- **THEN** the surface renders an actionable decision card for each open decision in the pinned
  header and a session-replay row for each story entry, oldest-first, showing its time, label, node
  title, and actor

#### Scenario: Timeline marks the boundary at the first entry new since the last visit

- **WHEN** the model resolves with a last-seen cursor and story entries past it
- **THEN** a "new since you left" divider is rendered immediately before the first entry whose seq
  is greater than the cursor — at the top of the list when the cursor is zero and every entry is
  new, and omitted entirely when no entry is newer than the cursor

#### Scenario: Timeline acknowledges the cursor when the human enters the session

- **WHEN** the human activates the surface's primary "enter session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: Timeline degrades gracefully when the data fails

- **WHEN** the digest or story request rejects
- **THEN** the surface shows an error message with a retry action rather than a blank surface

### Requirement: Re-entry surface selection

The web app SHALL let the returning human choose which of the three re-entry surfaces — briefing,
mission control, or timeline — greets them, and SHALL persist that choice across visits so the same
surface returns on the next re-entry. The selection SHALL be presented as a labelled radio-style
switcher; changing it SHALL persist the new choice and, while a surface is open, swap the rendered
surface live without losing the human's place in the app. The default selection SHALL be the
briefing. This switchable surface supersedes the original flat single-shape while-you-were-away
banner, which is no longer rendered.

The re-entry surface SHALL auto-open once on mount when the underlying re-entry data is ready and
there is something to show (an open decision or a node that moved while away); it SHALL be closeable;
and once closed it SHALL be reopenable from a visible "while you were away" trigger. While the
underlying data is loading or has failed, the surface SHALL render the switcher and trigger without
crashing rather than forcing a surface open.

#### Scenario: The human picks a re-entry surface and it persists

- **WHEN** the human selects the timeline surface from the re-entry view switcher
- **THEN** the timeline surface is rendered and the choice is persisted, so the timeline is the
  surface presented again on the next re-entry rather than the default briefing

#### Scenario: Switching the surface swaps the rendered view live

- **WHEN** a re-entry surface is open and the human selects a different surface in the switcher
- **THEN** the newly selected surface replaces the previously rendered one in place, with the choice
  persisted

#### Scenario: The surface auto-opens with content and can be reopened after closing

- **WHEN** the re-entry data is ready with at least one open decision or moved node
- **THEN** the selected surface auto-opens once; after the human closes it, it can be reopened from
  the visible "while you were away" trigger

#### Scenario: A missing or corrupt stored selection falls back to the default

- **WHEN** there is no persisted selection, or the persisted value is unreadable or not one of the
  three known surfaces
- **THEN** the briefing surface is selected as the default rather than erroring

