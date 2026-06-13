## ADDED Requirements

### Requirement: Streamable HTTP MCP endpoint
The system SHALL expose an MCP server over the Streamable HTTP transport. It MUST NOT use the deprecated HTTP+SSE transport.

#### Scenario: Agent connects over Streamable HTTP
- **WHEN** an MCP client initializes against the server's Streamable HTTP endpoint
- **THEN** the handshake completes and the server's tools are listed

### Requirement: Bootstrap via the instructions field
The server SHALL return, in `InitializeResult.instructions`, guidance that directs the connecting session to call `get_context` first and to park forks with `park_ask` rather than guessing.

#### Scenario: Instructions advertise the entry tool
- **WHEN** a client reads the `instructions` returned at `initialize`
- **THEN** the text instructs it to call `get_context` before doing other work

### Requirement: get_context tool
The server SHALL expose a `get_context` tool that, given a project, returns a compacted context pack containing the goal, open asks, recent answers/decisions, and session provenance. It MUST NOT return raw event rows.

#### Scenario: Context pack returned for a project
- **WHEN** an agent calls `get_context` for an existing project
- **THEN** the response contains the project goal, the list of open asks, and recent resolved decisions in summarized form

#### Scenario: Unknown project is rejected
- **WHEN** an agent calls `get_context` for a project id that does not exist
- **THEN** the server returns a typed not-found error and no context pack

### Requirement: Mutating tools require expected_version
The server SHALL expose `create_node`, `park_ask`, and `transition` tools. Tools that mutate an existing node or ask MUST require `expected_version` and, on mismatch, return the current state without mutating.

#### Scenario: park_ask creates an ask
- **WHEN** an agent calls `park_ask` with a valid node, type, and (for decisions) options
- **THEN** the ask is created in state `OPEN` and the tool returns its id and version

#### Scenario: Stale transition is rejected
- **WHEN** an agent calls `transition` with an `expected_version` that does not match the node's current version
- **THEN** the tool returns the current node state and a stale-version error, and the node is unchanged

#### Scenario: transition moves a node along the spine
- **WHEN** an agent calls `transition` to move a node from `DRAFT` to `ACTIVE` with the matching `expected_version`
- **THEN** the node status becomes `ACTIVE`, its version increments, and one event is appended

#### Scenario: transition rejects an illegal spine move
- **WHEN** an agent calls `transition` for a move not permitted by the status spine
- **THEN** the tool returns a validation error and the node is unchanged

#### Scenario: Mutations record session provenance
- **WHEN** an agent mutates a node via a tool while carrying a session id
- **THEN** that session id is recorded as provenance on the affected node

### Requirement: Tool inputs validated at the boundary
The server SHALL validate every tool argument against a shared schema and reject malformed input with a typed error before any domain logic runs.

#### Scenario: Malformed tool argument is rejected
- **WHEN** a tool is called with arguments that fail schema validation
- **THEN** the server returns a validation error and performs no mutation

### Requirement: Graceful failure on backend unavailability
When the persistence backend is unavailable or a transaction fails, a tool call SHALL return a typed error and MUST NOT leave partial state.

#### Scenario: Backend unavailable returns a typed error
- **WHEN** a mutating tool cannot reach the database
- **THEN** the tool returns a typed unavailable error and no partial mutation is observable
