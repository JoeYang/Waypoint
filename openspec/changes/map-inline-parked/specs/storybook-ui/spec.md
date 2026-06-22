# storybook-ui Specification

## ADDED Requirements

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
