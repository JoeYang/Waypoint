# Tasks

## 1. Data hook
- [ ] 1.1 Write `useReentry.test.ts` (red): loading → ready maps greeting/needsYou/activeWork/
  moved/headsUp/tallies/seq; `isNew` set on a needsYou decision when a matching waiting entry is
  new; digest rejection → error state with a working retry.
- [ ] 1.2 Implement `useReentry(projectId)` returning the discriminated state. Green.

## 2. Briefing surface
- [ ] 2.1 Add `Briefing.module.css` (axiom tokens, centered modal, section styling, danger/warning).
- [ ] 2.2 Write `Briefing.test.tsx` (red): ready renders needs-you DecisionCard(s), active-work
  line, heads-up; "Jump into the session" acks then calls `onClose`; loading + error states render.
- [ ] 2.3 Implement `Briefing` ({ projectId, onClose }) over `useReentry`. Green.

## 3. Verify
- [ ] 3.1 `npm test`, `npx tsc -b`, `npx eslint .` (own files clean), `npx prettier --write`.
- [ ] 3.2 `npx openspec validate reentry-briefing --strict`.
