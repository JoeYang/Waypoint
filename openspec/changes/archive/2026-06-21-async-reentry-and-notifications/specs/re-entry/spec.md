## ADDED Requirements

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
