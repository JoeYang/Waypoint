# re-entry Specification

## ADDED Requirements

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
