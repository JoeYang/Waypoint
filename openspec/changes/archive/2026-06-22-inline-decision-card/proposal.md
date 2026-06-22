# Inline decision act-card

## Why

The re-entry surfaces (S3) and other briefings need to let a returning human act on a parked
decision **without leaving the briefing** — the design's whole "re-entry becomes act on these two,
not go hunt for them". Today the only place to resolve a decision is the full-page `Proposal`
screen. We need one compact, reusable card that collapses the Proposal's approve / pick-option /
redirect interaction into a single inline unit, so every surface can embed it.

## What Changes

A new presentational + interactive web component **`DecisionCard`** (`packages/web`), driven by the
existing `Decision` view-model and the provider's existing `resolve` / `adjust` actions:

- **Approve the recommendation** in one click (collapsed primary action).
- **Review & redirect**: expand to option chips (each with its tradeoff and a "Recommended" pill)
  plus a constraint textarea; *Apply* resolves with the chosen option, or — when the textarea
  carries a constraint — *Send & apply* routes through `adjust` (an approval carrying a constraint
  note, per the existing PROPOSAL semantics).
- A **resolved** card is terminal (the agent resumes), matching the full Proposal's resolved banner.
- Surfaces the enriched signals from the digest: a **NEW** badge when the decision was parked since
  the viewer's last visit (`Decision.isNew`), the risk badge, and a high-risk red edge.

No new provider action, **no MCP-contract or DB-schema change**. `Decision` gains one optional
UI-only field `isNew?` (web view-model; the re-entry surfaces map it from the enriched digest).

## Impact

- `packages/web` only: `components/DecisionCard.{tsx,module.css}` + an optional `isNew?` on the web
  `Decision` type. Reuses `Badge` / `RiskBadge` / `Icon` and the provider's `resolve` / `adjust`.
- Consumed by S3 (the three re-entry directions); independently rendered + tested in this slice.
