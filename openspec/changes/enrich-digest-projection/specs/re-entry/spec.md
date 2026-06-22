# re-entry Specification

## ADDED Requirements

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
