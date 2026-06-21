## MODIFIED Requirements

### Requirement: Mutating tools require expected_version

The server SHALL expose `create_node`, `park_ask`, and `transition` tools. Tools that mutate an existing node or ask MUST require `expected_version` and, on mismatch, return the current state without mutating. The `create_node` tool MAY accept an optional `prUrl` — a GitHub pull request URL associated with the work behind the node — validated as a URL at the boundary; when supplied it SHALL be persisted on the node, and when omitted the node SHALL carry no PR URL (null). No GitHub API is called; the URL is opaque to Waypoint.

#### Scenario: create_node persists a supplied PR URL

- **WHEN** an agent calls `create_node` with a valid `prUrl`
- **THEN** the created node carries that `prUrl`

#### Scenario: create_node without a PR URL leaves it null

- **WHEN** an agent calls `create_node` without a `prUrl`
- **THEN** the created node's PR URL is null

#### Scenario: create_node rejects a malformed PR URL

- **WHEN** an agent calls `create_node` with a `prUrl` that is not a valid URL
- **THEN** the boundary rejects the input and creates nothing
