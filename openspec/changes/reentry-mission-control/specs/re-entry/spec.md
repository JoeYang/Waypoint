# re-entry Specification

## ADDED Requirements

### Requirement: Re-entry mission-control surface

The web app SHALL provide a re-entry **mission-control** surface: a full-screen takeover dialog
that catches a returning human up on a single project, presenting the whole picture at once. It
SHALL be driven by the same shared re-entry data hook as the briefing (no new contract or schema),
embedding the same actionable decision card per open decision so the act surface is identical
across re-entry modes.

- The surface SHALL render as a full-screen takeover dialog labelled "While you were away" with a
  top bar carrying a greeting (the viewer's name and the project name) and a "skip to session"
  action that closes the surface without acknowledging the cursor.
- The body SHALL present three columns: a **needs-you** column with an actionable decision card per
  open decision (or an all-clear line when there are none) and a heads-up sub-section styling each
  item danger or warning; a **where-things-stand** column listing active work as
  "{stream} — {task}" lines and a streams mini-list whose per-stream progress is derived from the
  live project snapshot (done tasks over total tasks); and a **while-you-were-away** column showing
  the moved (shipped) items as a feed.
- The surface SHALL render a footer stat strip summarizing the counts (decisions needing the human,
  active agents, items shipped while away, items to check) and a primary "enter session" action
  that acknowledges the digest read cursor at the model's seq and then closes the surface.
- The surface SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Mission control presents the three-column command deck

- **WHEN** the digest resolves for a project that has open decisions and active work
- **THEN** the surface renders an actionable decision card for each open decision, an active-work
  "{stream} — {task}" line, a per-stream progress row, and the moved feed

#### Scenario: Mission control acknowledges the cursor when the human enters the session

- **WHEN** the human activates the surface's primary "enter session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: Mission control degrades gracefully when the data fails

- **WHEN** the digest request rejects
- **THEN** the surface shows an error message with a retry action rather than a blank surface
