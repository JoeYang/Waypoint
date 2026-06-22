# storybook-ui Specification

## ADDED Requirements

### Requirement: Skeleton loading states

Async and live views SHALL render a low-fidelity skeleton placeholder while their data is loading,
instead of a bare line of loading text, so that the layout is anchored before content arrives and the
content swap is calm rather than an abrupt snap. A reusable presentational `Skeleton` component SHALL
provide the shimmer placeholder: it SHALL support a single block or `N` stacked line bars, accept
caller-supplied width, height, and corner radius, be marked decorative (`aria-hidden`) so it
contributes nothing to the accessibility tree, and SHALL disable its shimmer animation under
`prefers-reduced-motion`.

Every loading state that adopts skeletons SHALL preserve an accessible loading signal: the skeleton
SHALL be wrapped in an element exposing `role="status"` and an accessible "Loading…" name (via
visually-hidden text and/or `aria-busy`), so assistive technology still announces the loading state
and the state remains programmatically assertable. The provider's pre-content loading branch SHALL
render an app-shell skeleton (approximating sidebar + content), and each re-entry surface
(briefing, mission control, timeline) SHALL render skeleton rows in place of its loading text.

#### Scenario: Skeleton is decorative and supports stacked lines

- **WHEN** a `Skeleton` is rendered with a `lines` count
- **THEN** it renders that many line placeholders and the whole placeholder is hidden from the
  accessibility tree (`aria-hidden`), contributing no accessible name

#### Scenario: Provider loading branch shows a skeleton with a preserved accessible signal

- **WHEN** the provider is in its loading branch (an async load is in flight)
- **THEN** it renders skeleton placeholders AND exposes a `role="status"` region with an accessible
  "Loading…" name, so the loading state is announced and assertable

#### Scenario: Shimmer respects reduced-motion

- **WHEN** the user prefers reduced motion
- **THEN** the skeleton's shimmer animation is disabled while the placeholder still renders
