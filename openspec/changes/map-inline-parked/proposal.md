# Inline-actionable parked map node

## Why

On the project map a parked task (blocked on an unresolved decision) is the only interactive
node, but today it only shows a plain grey/amber "Decision parked" badge. The human has to open
the proposal just to learn *what* the decision is — the map gives no signal about the question or
its risk. The map should let the human read the parked decision's question at a glance and act on
it (open the proposal) directly from the node, with high-risk decisions visually marked so they
stand out while scanning.

## What Changes

The parked branch of `TaskNode` (`packages/web`) becomes an inline-actionable amber **parked row**
instead of a plain "Decision parked" badge:

- The node surfaces the actual decision **question** (`Decision.title`), falling back to
  "Decision parked" when no decision is passed.
- A clear **"Review →"** affordance (text + `arrowRight` icon) signals the node opens the proposal.
- The whole node stays a single `<button>` that opens the decision's proposal; its accessible name
  includes the question so it is reachable by that text and is fully keyboard-operable.
- A **high-risk** parked decision gets a visual accent (red left edge + a `RiskBadge`).

`ProjectMap` resolves each task's decision (`project.decisions.find(d => d.id === task.decision)`)
and passes it down as a new optional `decision?: Decision` prop on `TaskNode`. Lane / expansion
logic is unchanged. Non-blocked nodes and the resolved → resuming path are unchanged.

No MCP-contract or DB-schema change; **web-only** (presentational rework + one optional prop). The
provider's existing `openDecision` action drives the activation.

## Impact

- `packages/web` only: `components/TaskNode.{tsx,module.css}` (parked branch), `ProjectMap.tsx`
  (resolve + pass `decision`), and their tests. Reuses `RiskBadge` / `Icon`.
- Follow-up S4c builds on the richer parked node.
