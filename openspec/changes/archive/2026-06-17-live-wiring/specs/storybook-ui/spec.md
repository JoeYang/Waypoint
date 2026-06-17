## ADDED Requirements

### Requirement: The web data source resolves live backend data

The `WaypointSource` seam SHALL support a live implementation that draws from the backend: the
project map from `GET /v1/projects/:id/progress`, the decision inbox from `GET /v1/projects/:id/inbox`,
the activity timeline from `GET /v1/projects/:id/events`, and the cross-project home from
`GET /v1/projects`. The live source SHALL map backend DTOs to the existing view-model so no screen
changes; presentational fields with no backend equivalent (glyph, colour, description) resolve from
a web config keyed by project id, with a deterministic fallback. The mock source remains a valid
implementation of the same seam.

#### Scenario: Screens render live data through the unchanged seam

- **WHEN** the app is configured with the live source and a project has progress, asks, and events
- **THEN** the map, inbox, proposal, and activity screens render that live data with no change to the screen components

#### Scenario: Mock source still satisfies the seam

- **WHEN** the app is configured with the mock source
- **THEN** every screen renders the fixtures exactly as before

#### Scenario: Missing presentational config falls back

- **WHEN** a live project has no configured glyph/colour/description
- **THEN** the UI shows a deterministic generated glyph and colour rather than a blank or an error

### Requirement: Asynchronous load with loading, error, and empty states

The source SHALL load asynchronously, and every async surface SHALL render a loading state, an
error state with a retry action, and an empty state — never a blank screen. The retry re-invokes
the load.

#### Scenario: Loading then content

- **WHEN** a screen mounts while the live load is in flight
- **THEN** a loading state shows until the data resolves, then the content renders

#### Scenario: Backend unavailable

- **WHEN** the live load fails (timeout or connection refused)
- **THEN** an error state with a retry is shown, and activating retry re-attempts the load

#### Scenario: Empty project

- **WHEN** a live project has no parked decisions
- **THEN** the inbox shows its all-caught-up empty state, not a blank or an error

### Requirement: Answers are sent to the backend with optimistic concurrency

Resolving a decision SHALL POST to the answer endpoint carrying the ask's expected version; the
live WebSocket delta is the source of truth that removes the card. A stale-version response SHALL
reconcile (refetch and inform the human) rather than overwrite a concurrent answer. A comment on a
PROPOSAL ask SHALL be sent as an "adjust" verdict with an adjustment note; for non-PROPOSAL asks
the composer is hidden and the thread renders read-only.

#### Scenario: Resolve answers the ask and the card leaves on the live delta

- **WHEN** the human resolves a decision
- **THEN** the answer is posted with the expected version, and the card is removed when the WebSocket delta for that ask arrives

#### Scenario: Stale version reconciles without a lost write

- **WHEN** the ask was already answered (by another human or an agent assumption) and the human resolves with a now-stale version
- **THEN** the answer is rejected as stale, the source refetches, and the human is told it was already answered — no write is lost or clobbered

#### Scenario: A PROPOSAL comment becomes an adjustment

- **WHEN** the human sends a comment on a PROPOSAL ask
- **THEN** it is sent as an approve-with-adjustment carrying the note, which surfaces back to the agent

### Requirement: Live updates arrive over the WebSocket without polling

The inbox SHALL re-rank on a WebSocket delta and recover from a dropped connection via
resume-since-seq, refetching on a sequence-gap resync. The UI SHALL NOT poll.

#### Scenario: A newly parked ask appears live

- **WHEN** an agent parks an ask over MCP while the human is viewing the inbox
- **THEN** the new card appears via a WebSocket delta, ranked by blast radius, without a reload

#### Scenario: Reconnect and resync after a drop

- **WHEN** the WebSocket connection drops and reconnects with a sequence gap
- **THEN** the client resumes since its last seq and refetches on resync so no delta is silently missed
