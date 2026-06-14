# inbox Specification

## Purpose
TBD - created by archiving change add-core-ask-loop. Update Purpose after archive.
## Requirements
### Requirement: Inbox listing ranked by blast radius
The system SHALL provide a REST endpoint returning the open asks for a project, ranked by `blast_radius` descending and, for ties, by how long each has waited (oldest first). Each entry SHALL include its blast radius.

#### Scenario: Highest-impact ask ranks first
- **WHEN** the inbox is requested for a project with several open asks of differing blast radius
- **THEN** the ask with the greatest blast radius is returned first

#### Scenario: Ties broken by wait time
- **WHEN** two open asks have equal blast radius
- **THEN** the one parked earlier is returned first

### Requirement: Answer an ask via REST
The system SHALL provide a REST endpoint for a human to answer an ask. The request MUST carry `expected_version`; on success the ask and its node are updated and an event is appended atomically.

#### Scenario: Answering updates state and emits an event
- **WHEN** a human submits a valid answer for an open ask with the correct `expected_version`
- **THEN** the ask becomes `ANSWERED`, its node's computed `blocked` is recomputed, and one event is appended

#### Scenario: Stale answer is rejected
- **WHEN** a human submits an answer with an `expected_version` that no longer matches
- **THEN** the endpoint rejects the request, returns the current state, and changes nothing

### Requirement: Live inbox updates over WebSocket
The system SHALL push delta updates to connected clients when asks or their blast radius change. A single mutation MAY produce one delta covering multiple affected asks/nodes — deltas are derived projections of the one underlying event. On reconnect a client SHALL be able to resume from its last received `seq` without missing or duplicating deltas.

#### Scenario: Answering re-ranks the queue live
- **WHEN** an ask is answered and a node becomes unblocked
- **THEN** connected clients receive a delta reflecting the answered ask and the changed rankings

#### Scenario: Reconnect resumes from last seq
- **WHEN** a client reconnects supplying its last received `seq`
- **THEN** the server sends only the events after that `seq`

#### Scenario: Resume gap triggers a full resync
- **WHEN** a client reconnects with a `seq` older than the server's retained history
- **THEN** the server instructs the client to resync the full inbox instead of replaying deltas

#### Scenario: Duplicate delta is idempotent
- **WHEN** a client receives a delta for a `seq` it has already applied
- **THEN** the client's state is unchanged

### Requirement: Minimal inbox screen
The web app SHALL render an Inbox screen listing asks as cards in ranked order, each showing how many nodes it blocks ("blocks N"). Answering a card SHALL move it to a "working" state and re-rank the list from the live update, without a full page reload. The screen MUST handle loading, error, and empty states.

#### Scenario: Answered card flips to working and the next rises
- **WHEN** a human answers the top card
- **THEN** that card shows a "working" state and the next-highest-impact ask moves to the top from the live delta

#### Scenario: Empty inbox shows an empty state
- **WHEN** a project has no open asks
- **THEN** the Inbox screen shows an explicit empty state rather than a blank screen

