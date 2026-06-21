## ADDED Requirements

### Requirement: Project map folds completed plan lanes by default

The project map SHALL render each stream (plan) as a lane whose header is an accessible
toggle control. The header SHALL be a real `<button>` exposing its expanded/collapsed
state via `aria-expanded`, fully keyboard operable, and meeting WCAG AA contrast. A lane
whose stream status is `done` SHALL start collapsed; a lane with any other status
(`active`, `blocked`, `queued`) SHALL start expanded. When a lane is collapsed its task
nodes SHALL NOT be rendered, while the lane name, status badge, and the `N/N done`
progress summary SHALL remain visible. Activating a lane header SHALL toggle that lane's
expanded state independently of the other lanes.

#### Scenario: Completed lane starts collapsed

- **WHEN** the project map renders a stream whose status is `done`
- **THEN** that lane's task nodes are not visible, but its header, badge, and progress summary remain visible, and its header reports `aria-expanded="false"`

#### Scenario: Expanding a collapsed lane reveals its tasks

- **WHEN** a human activates the header of a collapsed done lane
- **THEN** the lane's task nodes become visible and its header reports `aria-expanded="true"`

#### Scenario: In-progress lane starts expanded

- **WHEN** the project map renders a stream whose status is not `done` (for example `active` or `blocked`)
- **THEN** that lane's task nodes are visible by default and its header reports `aria-expanded="true"`
