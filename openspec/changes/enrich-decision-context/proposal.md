## Why

The inbox loop works, but the cards are too thin to decide from. A human answering
asynchronously — often hours later, out of the agent's context — sees only the prompt and
bare option labels. They can't tell *why* the agent is asking, *what work is actually
blocked*, or *what each option commits them to*. The result: low-confidence answers, or none.

This change makes a parked decision self-explanatory. It adds the context the human lacks
from two sources: what the agent knows (a rationale and a consequence per option) and what
the system already stores (which nodes are blocked, the goal the work ladders toward, and
who parked it when). It also raises the inbox UI to the bar of the sibling "backlog" tool,
which shares Waypoint's Axiom design system but presents far richer cards.

## What Changes

- Extend the `park_ask` MCP tool so an agent supplies, alongside the prompt: a **rationale**
  (why this decision is needed now) and, for a DECISION, a **consequence** per option (what
  choosing it commits to). Both are optional — older callers still work — but the
  `instructions` bootstrap directs agents to provide them.
- Carry `rationale` on the `ask` and a `consequence` on each `AskOption`. Consequences ride
  in the existing `options` jsonb (no DDL); `rationale` is one new nullable column.
- Enrich the inbox read model (`core.listInbox`) so each item also reports, derived from data
  already stored: the **blocked nodes** (by title), the **goal** the node ladders toward, and
  **provenance** (the session that parked it, and when) — all computed in the existing single
  transaction, no N+1.
- Redesign the inbox card to present this: a stakes/wait header with the node's place in the
  tree, the prompt, "why this is being asked", the blocked-work list, per-option consequences,
  and provenance — Axiom-styled, with the answer→removal→re-rank transition animated.

## Capabilities

### Modified Capabilities
- `agent-mcp-api`: `park_ask` gains an optional `rationale` and per-option `consequence`; the
  `instructions` bootstrap tells agents to explain the why and the trade-offs, not just the
  prompt.
- `inbox`: the inbox read model and card surface decision context — rationale, blocked work,
  goal ancestry, per-option consequences, and provenance — so a human can answer with
  confidence; the card is redesigned to the backlog tool's polish bar.

## Impact

- **Schema**: one migration — add nullable `ask.rationale` and `ask.session_id`. Option
  consequences ride in the existing `ask.options` jsonb. `session_id` makes provenance a direct
  read and lets `listInbox` stop loading the entire event log (it now uses a cheap
  `latestSeq()` for the seq) — the enrichment makes the WS-hot read path *faster*, not slower.
  Migration and down step reversible; never edit an applied migration.
- **Contract change** (reviewed): `park_ask` gains an optional `rationale` and accepts options
  as either bare strings (unchanged) or `{label, consequence?}` objects, normalized at the
  boundary — so existing string-only seeds keep working with no shim. `rationale` (≤2000) and
  `consequence` (≤280) are length-capped at the boundary so the fields can't become a DoS or
  layout hazard.
- **Code**: `shared` contracts, `core.listInbox` + `parkAsk`, the Postgres ask mapper, the MCP
  tool + instructions, and the `web` card. No change to the import-direction boundaries.
- **Out of scope (later)**: a full two-pane detail view with a metadata sidebar, board/list
  view toggle, and a notification layer (toasts/desktop) — adopt from the backlog tool once
  the richer card lands.
