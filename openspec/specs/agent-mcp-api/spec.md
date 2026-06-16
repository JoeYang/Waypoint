# agent-mcp-api Specification

## Purpose
TBD - created by archiving change add-core-ask-loop. Update Purpose after archive.
## Requirements
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

### Requirement: Decision context and consequences on park_ask

The `park_ask` tool SHALL accept, in addition to the prompt, an optional `rationale` explaining why the
decision is needed, and — for a `DECISION` — an optional `consequence` on each option describing what
choosing it commits to. Options MAY be supplied as bare strings or as `{ label, consequence? }` objects,
normalized at the boundary. For a `QUESTION`, the tool SHALL accept optional `suggestedAnswers`. These
fields are optional so existing callers remain valid, but the `instructions` bootstrap SHALL direct
agents to provide them so the human can answer without re-deriving context.

#### Scenario: Agent parks a decision with rationale and per-option consequences

- **WHEN** an agent calls `park_ask` for a DECISION with a `rationale` and a `consequence` on each option
- **THEN** the ask is parked carrying the rationale, and each stored option carries its consequence

#### Scenario: Agent parks a question with suggested answers

- **WHEN** an agent calls `park_ask` for a QUESTION with `suggestedAnswers`
- **THEN** the ask is parked carrying those suggestions for the human to pick from

#### Scenario: Context is optional and backward-compatible

- **WHEN** an agent calls `park_ask` with only string labels and no rationale, consequences, or suggestions
- **THEN** the ask is parked successfully with an absent rationale and options without consequences

#### Scenario: Bootstrap directs agents to explain

- **WHEN** a session reads the MCP `instructions` field
- **THEN** the guidance tells it to supply a rationale, a consequence per option, and suggested answers for questions, not just the prompt

### Requirement: Provenance carries a stable agent label

`park_ask` SHALL accept an optional human-friendly `agentLabel` recorded as provenance on the ask. When
omitted, the system SHALL derive a stable alias from the session id (the same session yields the same
alias). This label — never a raw session id — is what downstream surfaces (the inbox provenance and the
project story) display, so the narrative reads naturally.

#### Scenario: An explicit agent label is recorded

- **WHEN** an agent parks an ask with `agentLabel` set
- **THEN** the ask records that label as its provenance

#### Scenario: A missing label falls back to a stable alias

- **WHEN** an agent parks an ask without an `agentLabel`
- **THEN** the ask records a stable alias derived from the session id, identical for the same session

### Requirement: An adjusted proposal reaches the agent as an approval-with-constraint

When a human answers a `PROPOSAL` with **Adjust** and a constraint note, the system SHALL record it as a
single immutable approval event carrying the constraint, and SHALL surface that constraint back to the
agent through the answer result and the `get_context` pack — so the agent proceeds with the constraint
rather than waiting on a new ask.

#### Scenario: Adjust surfaces the constraint to the agent

- **WHEN** a human approves a proposal with an adjustment note
- **THEN** the ask is resolved as approved, one event records the constraint, and the agent reads the constraint via the answer result and `get_context`

