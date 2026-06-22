# storybook-ui Specification

## ADDED Requirements

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
