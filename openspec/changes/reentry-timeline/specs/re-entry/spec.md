# re-entry Specification

## ADDED Requirements

### Requirement: Re-entry timeline surface

The web app SHALL provide a re-entry **timeline** surface: a right-side drawer dialog that replays,
for a returning human on a single project, what happened while they were away as a chronological
feed — the project story read back as "who did what, to which node", oldest-first. It SHALL be
driven by the same shared re-entry data hook as the briefing and mission-control surfaces (no new
contract or schema), embedding the same actionable decision card per open decision so the act
surface is identical across re-entry modes.

- The surface SHALL render as a right-side drawer dialog labelled "While you were away" with a
  pinned header section "Needs you · {count}" carrying an actionable decision card per open decision
  (or an all-clear line when there are none).
- The surface SHALL render a "session replay" list of the project story entries, oldest-first, each
  entry showing a time-of-day label derived from the entry's timestamp, a label taken from the
  entry's summary (falling back to its verb), the node title, and the resolved actor label when one
  is present.
- The surface SHALL mark the "new since you left" boundary by rendering a divider immediately before
  the first story entry whose sequence is greater than the digest's last-seen cursor (`sinceSeq`).
  When the cursor is zero (never visited) so every entry is new, the divider SHALL sit at the top of
  the list; when no entry is newer than the cursor, no divider SHALL be rendered.
- The surface SHALL render a primary "enter session" action that acknowledges the digest read cursor
  at the model's seq and then closes the surface.
- The surface SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Timeline replays the session oldest-first with the needs-you cards pinned

- **WHEN** the digest and story resolve for a project that has open decisions and story entries
- **THEN** the surface renders an actionable decision card for each open decision in the pinned
  header and a session-replay row for each story entry, oldest-first, showing its time, label, node
  title, and actor

#### Scenario: Timeline marks the boundary at the first entry new since the last visit

- **WHEN** the model resolves with a last-seen cursor and story entries past it
- **THEN** a "new since you left" divider is rendered immediately before the first entry whose seq
  is greater than the cursor — at the top of the list when the cursor is zero and every entry is
  new, and omitted entirely when no entry is newer than the cursor

#### Scenario: Timeline acknowledges the cursor when the human enters the session

- **WHEN** the human activates the surface's primary "enter session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: Timeline degrades gracefully when the data fails

- **WHEN** the digest or story request rejects
- **THEN** the surface shows an error message with a retry action rather than a blank surface
