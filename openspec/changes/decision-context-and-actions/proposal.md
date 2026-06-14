## Why

The V1 inbox card answers _"what is being asked"_ and refuses _"what do I need to know to answer."_
The founder's three complaints — the layout is uninformative, the buttons don't reflect intent, and
answering means typing long responses with no context — are one root cause: the human is asked to
decide with the context stripped away, so they either re-derive it (worse than synchronous) or
compensate with prose (the typing tax).

This change is **slice 1 of the V2 arc**. It makes a parked ask self-explanatory and makes the answer
a single intent-matched gesture, so the human rarely has to type. It is the highest-leverage,
lowest-cost slice and lands on top of the existing inbox shell.

## What Changes

- Extend `park_ask` so an agent supplies, alongside the prompt: a **rationale** (why the decision is
  needed now) and, per option, a **consequence** (what choosing it commits to, and what it unblocks).
  Both optional for backward compatibility; the `instructions` bootstrap directs agents to provide them.
- Enrich the inbox read model so each item also reports, from data already stored: the **named blocked
  work** (the dependent tasks' titles, not just a count), the **goal** the task ladders toward, and
  **provenance** — who parked it (a stable, human-friendly **agent label**, not a raw session id) and
  when. The agent label is the foundation the slice-3 story reads back, so it is owned here.
- Redesign the decision card so the consequence sits **beside each option** and the recommended option
  is visually distinguished — the right choice is self-evident before the click.
- Make the answer action **match the ask type**: DECISION = options; PROPOSAL = Approve / Adjust /
  Reject (Adjust, and only Adjust, opens a single text field); QUESTION = agent-suggested answers first,
  with free text as an opt-in fallback. An **Adjust** is an _approval carrying a constraint note_ — it
  records one immutable event and surfaces the constraint back to the agent (via the answer result and
  `get_context`), not a second round-trip ask.

## Capabilities

### Modified Capabilities

- `agent-mcp-api`: `park_ask` gains an optional `rationale`, an optional per-option `consequence`, and
  optional `suggestedAnswers` for a QUESTION; the `instructions` bootstrap tells agents to explain the
  why and the trade-offs so the human can answer without typing.
- `inbox`: the read model and card surface decision context — rationale, named blocked work, goal,
  per-option consequence, provenance — and the answer surface becomes intent-matched, so the human
  acts in one gesture and types only by choice.

## Impact

- **Schema**: one migration — add nullable `ask.rationale`. Per-option `consequence` and a QUESTION's
  `suggestedAnswers` ride in the existing `ask.options` / a small jsonb field (no DDL beyond rationale).
  Reversible down step. Provenance uses the existing session/created-at columns.
- **Contract change** (ask-first): `park_ask` gains optional fields; `options` accept bare strings
  (unchanged) or `{ label, consequence? }` objects, normalized at the boundary so existing callers keep
  working. `rationale` (≤2000) and `consequence` (≤280) are length-capped at the boundary.
- **Answer + identity contract** (ask-first): the answer payload is intent-typed — a chosen option, a
  proposal verdict (`approve | adjust | reject`, with an optional capped constraint note on `adjust`), or
  free text. An adjusted proposal records one immutable event and is surfaced to the agent via the answer
  result and `get_context`. `park_ask` accepts an optional human-friendly `agentLabel` for provenance,
  falling back to a stable alias derived from the session id — so the slice-3 story reads naturally.
- **Code**: `shared` contracts, `core` ask read model and `parkAsk`, the Postgres ask mapper, the MCP
  tool and its instructions, and the `web` card. No change to the import-direction boundaries.
- **Forward-compat**: the card must be a self-contained unit, because slice 2 re-homes it inside the
  project spine. No layout assumptions that depend on the flat-list shell.
- **Out of scope (later slices)**: the project spine and the inbox-as-lens repositioning (slice 2); the
  while-you-were-away story and notifications (slice 3).
