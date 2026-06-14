## ADDED Requirements

### Requirement: Decision context on park_ask
The `park_ask` tool SHALL accept, in addition to the prompt, an optional `rationale`
explaining why the decision is needed, and — for a `DECISION` — an optional `consequence`
on each option describing what choosing it commits to. Options are supplied as
`{ label, consequence? }` objects. These fields are optional so existing callers remain
valid, but the `instructions` bootstrap SHALL direct agents to provide them.

#### Scenario: Agent parks a decision with rationale and per-option consequences
- **WHEN** an agent calls `park_ask` for a DECISION with a `rationale` and a `consequence` on each option
- **THEN** the ask is parked carrying the rationale, and each stored option carries its consequence

#### Scenario: Context is optional
- **WHEN** an agent calls `park_ask` with only labels and no rationale or consequences
- **THEN** the ask is parked successfully with an absent rationale and options without consequences

#### Scenario: Bootstrap directs agents to explain
- **WHEN** a session reads the MCP `instructions` field
- **THEN** the guidance tells it to supply a rationale and a consequence per option, not just the prompt
