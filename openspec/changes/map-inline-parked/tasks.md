# Tasks

## 1. web — component (TDD red→green)

- [ ] 1.1 `TaskNode` gains an optional `decision?: Decision` prop (existing props unchanged).
- [ ] 1.2 `TaskNode.module.css`: amber inline parked row — question text, "Review →" affordance,
      and a high-risk red left-edge accent.
- [ ] 1.3 Rework the parked branch of `TaskNode`: render the decision question + a "Review →"
      affordance inside the still-interactive `<button>`; accessible name includes the question;
      add the high-risk accent + `RiskBadge` when `decision.risk === "high"`. Fall back to
      "Decision parked" when no decision is supplied.
- [ ] 1.4 `ProjectMap` resolves each task's decision via `project.decisions.find` and passes it to
      `TaskNode` as `decision`. Lane/expansion logic unchanged.
- [ ] 1.5 Tests: a parked task renders the decision question + a Review affordance; activating it
      calls `onOpenDecision` with the decision id; a high-risk parked decision shows the risk
      accent/badge; the plain fallback renders when no decision is supplied. Existing tests stay
      green (parked-node assertions updated to the new markup, not skipped).

## Follow-ups (separate changes)

- [ ] S4c builds further on the richer inline parked node.
