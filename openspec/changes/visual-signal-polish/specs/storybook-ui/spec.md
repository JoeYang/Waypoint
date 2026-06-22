# storybook-ui Specification

## ADDED Requirements

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
