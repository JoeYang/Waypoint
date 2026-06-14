## ADDED Requirements

### Requirement: Decision context in the inbox read model
Each inbox item SHALL carry the context a human needs to answer without the agent's session
state: the agent's `rationale`, a `consequence` per option, the titles of the nodes the
ask's node blocks, the goal the node ladders toward, and provenance (the session that parked
it and when). Derived fields SHALL be computed from data already stored — `depends_on` edges,
the node hierarchy, and the append-only event log — in the same read, without an N+1.

#### Scenario: Item reports the work it blocks and the goal it serves
- **WHEN** the inbox is requested and an ask's node has dependents and an ancestor goal
- **THEN** the item lists the blocked nodes' titles and the goal's title

#### Scenario: Item reports provenance
- **WHEN** an ask was parked by a session
- **THEN** the item reports that session id and the time it was parked

#### Scenario: Missing context degrades gracefully
- **WHEN** an ask has no rationale, no option consequences, no dependents, and no ancestor goal
- **THEN** the item omits those fields rather than failing

## MODIFIED Requirements

### Requirement: Minimal inbox screen
The web app SHALL render an Inbox screen listing asks as cards in ranked order. Each card
SHALL present enough context to decide from: a stakes header (ask type, how many nodes it
blocks, and how long it has waited), the prompt, the agent's rationale ("why this is being
asked"), the blocked-work list and the goal the work ladders toward, the options each shown
with its consequence, and provenance. Answering a card SHALL move it to a "working" state and
re-rank the list from the live update, without a full page reload. The screen MUST handle
loading, error, and empty states, and MUST remain readable when optional context is absent.

#### Scenario: Card shows why and the consequence of each choice
- **WHEN** a decision card with a rationale and per-option consequences is rendered
- **THEN** the card shows the rationale and each option's consequence beside the option

#### Scenario: Card shows what is blocked and toward which goal
- **WHEN** an ask's node blocks other nodes and ladders toward a goal
- **THEN** the card lists the blocked work and names the goal

#### Scenario: Answered card flips to working and the next rises
- **WHEN** a human answers the top card
- **THEN** that card shows a "working" state and the next-highest-impact ask moves to the top from the live delta

#### Scenario: Empty inbox shows an empty state
- **WHEN** a project has no open asks
- **THEN** the Inbox screen shows an explicit empty state rather than a blank screen
