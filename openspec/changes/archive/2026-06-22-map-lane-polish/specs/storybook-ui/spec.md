# storybook-ui Specification

## ADDED Requirements

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
