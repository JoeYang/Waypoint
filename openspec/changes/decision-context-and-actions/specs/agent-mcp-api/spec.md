## ADDED Requirements

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
