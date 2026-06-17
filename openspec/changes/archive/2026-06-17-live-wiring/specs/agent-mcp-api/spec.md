## ADDED Requirements

### Requirement: park_ask carries agent-declared risk and reversibility

The `park_ask` tool SHALL accept two optional fields: `risk` (`low | medium | high`) and
`reversible` (boolean). They are stored on the ask and surfaced on the inbox item, so the human
surface shows the agent's own judgement of how risky and how reversible the decision is rather than
inferring it. Both are optional so existing callers remain valid; when absent the system SHALL treat
`risk` as `medium` and `reversible` as `true`. The MCP `instructions` bootstrap SHALL direct agents
to supply them for a DECISION or PROPOSAL.

#### Scenario: Agent parks a decision with risk and reversibility

- **WHEN** an agent calls `park_ask` for a DECISION with `risk: "high"` and `reversible: false`
- **THEN** the ask is parked carrying that risk and reversibility, and they appear on the inbox item for that ask

#### Scenario: Fields are optional and backward-compatible

- **WHEN** an agent calls `park_ask` without `risk` or `reversible`
- **THEN** the ask is parked successfully and is treated as `medium` risk and reversible

#### Scenario: Invalid risk is rejected at the boundary

- **WHEN** an agent calls `park_ask` with a `risk` outside `low | medium | high`
- **THEN** the call is rejected with a validation error and no ask is parked
