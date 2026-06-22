# re-entry Specification

## ADDED Requirements

### Requirement: Re-entry surface selection

The web app SHALL let the returning human choose which of the three re-entry surfaces — briefing,
mission control, or timeline — greets them, and SHALL persist that choice across visits so the same
surface returns on the next re-entry. The selection SHALL be presented as a labelled radio-style
switcher; changing it SHALL persist the new choice and, while a surface is open, swap the rendered
surface live without losing the human's place in the app. The default selection SHALL be the
briefing. This switchable surface supersedes the original flat single-shape while-you-were-away
banner, which is no longer rendered.

The re-entry surface SHALL auto-open once on mount when the underlying re-entry data is ready and
there is something to show (an open decision or a node that moved while away); it SHALL be closeable;
and once closed it SHALL be reopenable from a visible "while you were away" trigger. While the
underlying data is loading or has failed, the surface SHALL render the switcher and trigger without
crashing rather than forcing a surface open.

#### Scenario: The human picks a re-entry surface and it persists

- **WHEN** the human selects the timeline surface from the re-entry view switcher
- **THEN** the timeline surface is rendered and the choice is persisted, so the timeline is the
  surface presented again on the next re-entry rather than the default briefing

#### Scenario: Switching the surface swaps the rendered view live

- **WHEN** a re-entry surface is open and the human selects a different surface in the switcher
- **THEN** the newly selected surface replaces the previously rendered one in place, with the choice
  persisted

#### Scenario: The surface auto-opens with content and can be reopened after closing

- **WHEN** the re-entry data is ready with at least one open decision or moved node
- **THEN** the selected surface auto-opens once; after the human closes it, it can be reopened from
  the visible "while you were away" trigger

#### Scenario: A missing or corrupt stored selection falls back to the default

- **WHEN** there is no persisted selection, or the persisted value is unreadable or not one of the
  three known surfaces
- **THEN** the briefing surface is selected as the default rather than erroring
