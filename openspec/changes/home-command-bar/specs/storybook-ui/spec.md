# storybook-ui Specification

## ADDED Requirements

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
