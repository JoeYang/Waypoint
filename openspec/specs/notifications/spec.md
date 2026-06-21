# notifications Specification

## Purpose
TBD - created by archiving change async-reentry-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Tiered, batched notifications

The system SHALL deliver notifications in tiers so it is worth opening without becoming spam. Most asks
SHALL wait silently for the human's next visit. A digest SHALL be delivered on the human's chosen cadence.
A single immediate push SHALL be emitted only when an ask's blast radius crosses a user-set threshold or
the ask ages past a user-set SLA. The system SHALL NOT emit one notification per ask. Cadence and
thresholds SHALL be user-set, not fixed. Notifications SHALL carry the `event.seq` and non-sensitive
summary only — never sensitive payloads.

#### Scenario: A high-impact decision escalates immediately

- **WHEN** an ask's blast radius crosses the user's threshold
- **THEN** a single push is emitted for that ask

#### Scenario: An aging ask escalates

- **WHEN** an ask remains unanswered past the user's SLA
- **THEN** it escalates from the batch to a push

#### Scenario: Ordinary asks are batched, not pushed

- **WHEN** several low-impact asks are parked within a cadence window
- **THEN** they are summarized in the next digest rather than each emitting a push

#### Scenario: Notifications carry no sensitive payload

- **WHEN** a notification is emitted
- **THEN** it includes the event seq and a non-sensitive summary, not tokens, PII, or decision payloads

### Requirement: Notification delivery is best-effort

A failure in the notification transport SHALL NOT fail the underlying mutation or corrupt state; the
durable event log and the digest computed from it remain the source of truth, and the human still
re-acquires context on their next visit.

#### Scenario: Transport down does not break the loop

- **WHEN** the notification transport is unavailable at the moment an ask is parked
- **THEN** the ask is parked durably, no state is corrupted, and the digest still reports it on return

