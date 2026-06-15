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

The web app SHALL render the inbox as cards in ranked order, and each card SHALL present enough context
to decide from: a header with the ask type and the named work it blocks, the prompt, the agent's
rationale, the blocked-work list and the goal, the options each shown with its consequence (or the
intent-matched action for proposals and questions), and provenance. Answering SHALL move the card to a
"working" state and re-rank from the live update without a full reload. The screen MUST handle loading,
error, and empty states, and MUST remain readable when optional context is absent. The card MUST be a
self-contained unit so it can be re-homed inside the project spine in a later slice.

#### Scenario: Card shows why and the consequence of each choice

- **WHEN** a decision card with a rationale and per-option consequences is rendered
- **THEN** the card shows the rationale and each option's consequence beside the option

#### Scenario: Card shows the named work blocked and the goal

- **WHEN** an ask's node blocks other tasks and ladders toward a goal
- **THEN** the card lists the blocked tasks by title and names the goal

#### Scenario: Answered card flips to working and the next rises

- **WHEN** a human answers the top card
- **THEN** that card shows a "working" state and the next-highest-impact ask moves up from the live delta

#### Scenario: Empty inbox shows an empty state

- **WHEN** a project has no open asks
- **THEN** the inbox shows an explicit empty state rather than a blank screen

### Requirement: Decision context in the inbox read model

Each inbox item SHALL carry the context a human needs to answer without the agent's session state: the
agent's `rationale`, a `consequence` per option, the **titles** of the tasks the ask's node blocks (not
only a count), the goal the node ladders toward, and provenance (a stable human-friendly agent label —
not a raw session id — and when it was parked). Derived fields
SHALL be computed from data already stored — `depends_on` edges, the node hierarchy — in the same read,
without an N+1, with a cycle guard on the ancestry walk.

#### Scenario: Item reports the named work it blocks and the goal it serves

- **WHEN** the inbox is requested and an ask's node has dependents and an ancestor goal
- **THEN** the item lists the blocked tasks' titles and the goal's title

#### Scenario: Missing context degrades gracefully

- **WHEN** an ask has no rationale, no option consequences, no dependents, and no ancestor goal
- **THEN** the item omits those fields rather than failing

### Requirement: Intent-matched answer actions

The answer surface SHALL match the ask type so the human acts in one gesture and types only by choice.
A DECISION SHALL present its options, each shown with its consequence. A PROPOSAL SHALL present
**Approve / Adjust / Reject**, where only Adjust opens a single free-text field; an Adjust SHALL be
recorded as an approval carrying the constraint note (one immutable event), not a new ask. A QUESTION
SHALL present the agent's suggested answers first, with free text as an opt-in fallback.

#### Scenario: A proposal offers verdicts, not a blank essay

- **WHEN** a PROPOSAL ask is rendered
- **THEN** the human sees Approve, Adjust, and Reject, and a text field appears only after choosing Adjust

#### Scenario: A question offers suggestions before free text

- **WHEN** a QUESTION ask with suggested answers is rendered
- **THEN** the suggestions are selectable directly and typing is an optional fallback

