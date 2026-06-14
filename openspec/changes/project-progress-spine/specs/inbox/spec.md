## MODIFIED Requirements

### Requirement: Minimal inbox screen

The inbox SHALL be a **lens** over the project spine — a saved filter that shows the ranked asks needing
the human — rather than the application home. It SHALL present the same enriched, intent-matched cards as
the spine, filtered to open asks, and SHALL remain reachable from the spine. The lens MUST handle loading,
error, and empty states. Answering from the lens SHALL behave identically to answering on the spine
(move to "working", re-rank from the live delta, no full reload). The lens SHALL remain a stable
first-class route so deep-links and tooling built on the V1 inbox continue to work.

#### Scenario: Inbox is reachable as a lens, not the home

- **WHEN** a human opens the application
- **THEN** the project spine is the home and the inbox is reachable from it as a "needs you" filter

#### Scenario: The lens shows the same cards as the spine

- **WHEN** an ask is open
- **THEN** it appears in the inbox lens with the same context and intent-matched actions it has on the spine

#### Scenario: The lens is reachable by a stable direct route

- **WHEN** a client navigates directly to the inbox lens route without first loading the spine
- **THEN** the pending-asks view loads, preserving the V1 inbox entry point for tooling and deep-links

#### Scenario: Empty lens shows an empty state

- **WHEN** a project has no open asks
- **THEN** the inbox lens shows an explicit empty state rather than a blank screen
