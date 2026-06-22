# Tasks

## 1. web — component (TDD red→green)

- [x] 1.1 `Decision` view-model gains optional `isNew?` (UI-only, mapped from the enriched digest).
- [x] 1.2 `DecisionCard` styles (`DecisionCard.module.css`) on the Axiom tokens — risk red edge,
      review panel, resolved row.
- [x] 1.3 `DecisionCard` component: collapsed (approve-recommended + review-&-redirect + rec note),
      review panel (option chips with tradeoff + Recommended pill, constraint textarea, Apply /
      Send & apply / Cancel), and the terminal resolved row. Uses the provider's resolve/adjust.
- [x] 1.4 Tests: approve-recommended resolves; pick a non-rec option and apply; a constraint routes
      through adjust (Send & apply); cancel collapses; NEW badge when `isNew`; collapsed hides chips.

## Follow-ups (separate changes)

- [ ] S3 embeds `DecisionCard` in the three re-entry directions, mapping digest `isNew`/risk in.
