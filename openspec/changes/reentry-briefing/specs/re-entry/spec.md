# re-entry Specification

## ADDED Requirements

### Requirement: Re-entry briefing surface

The web app SHALL provide a re-entry **briefing** surface: a centered modal dialog that catches a
returning human up on a single project from the enriched while-you-were-away digest and the project
story, read through the existing data seam (no new contract or schema). The briefing SHALL be
driven by a shared re-entry data hook that maps the digest + story + the project's open decisions
into a surface-ready model and exposes a loading / error / ready state, so the other re-entry
surfaces can reuse the same hook unchanged.

- The hook SHALL fetch the digest and story for the given project on mount and expose a
  discriminated state: **loading** while either request is pending, **error** (with a retry action)
  when the digest or story request rejects, and **ready** with the mapped model otherwise.
- The ready model SHALL carry a greeting (the project name and the viewer's name), the project's
  open decisions as **needs-you** items, where the agent is working now (**active work**), what
  **moved** (shipped), the **heads-up** items, the task **tallies**, and the digest **seq** for
  acknowledgement. A needs-you decision SHALL be marked **new** exactly when a waiting digest entry
  with the same ask id is itself new.
- The briefing SHALL render the greeting with a count of decisions needing the human, an inline
  actionable decision card for each needs-you item (or an all-clear line when there are none), the
  active-work and moved summaries, and the heads-up items with danger/warning emphasis. Its primary
  action SHALL acknowledge the digest read cursor at the model's seq and then close the surface.
- The briefing SHALL render a loading state while the model is pending and an error state with a
  retry when the underlying data fails, never a blank surface.

#### Scenario: Briefing leads with the decisions that need the human

- **WHEN** the digest and story resolve for a project that has open decisions
- **THEN** the briefing shows a greeting counting the decisions needing the human and renders an
  actionable decision card for each open decision, followed by the active-work, moved, and heads-up
  summaries

#### Scenario: A waiting decision new since the last visit is flagged in the briefing

- **WHEN** a project decision matches a waiting digest entry (same ask id) that is marked new
- **THEN** the corresponding needs-you item in the model is marked new

#### Scenario: The briefing acknowledges the cursor when the human jumps in

- **WHEN** the human activates the briefing's primary "jump into the session" action
- **THEN** the digest read cursor is acknowledged at the model's seq and the surface is closed

#### Scenario: The briefing degrades gracefully when the data fails

- **WHEN** the digest or story request rejects
- **THEN** the briefing shows an error message with a retry action rather than a blank surface
