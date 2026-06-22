# Tasks — Consistent visual decision signals

## 1. OpenSpec

- [x] 1.1 Write proposal, tasks, and the `storybook-ui` spec delta; `openspec validate
  visual-signal-polish --strict`.

## 2. Tests (red first)

- [x] 2.1 Inbox: a high-risk row (`d3`) carries the high-risk row class; a hover chevron element
  is present on the rows.
- [x] 2.2 Proposal: the recommended option carries the rec-wash marker; the high-risk decision
  (`d3`) gives the proposal header/container its high-risk accent class.
- [x] 2.3 DecisionCard: an `isNew` card carries the new-since-left accent marker; the recommended
  review chip carries the rec-wash marker.

## 3. CSS

- [x] 3.1 Inbox `qrow`: hover 1px lift + sliding chevron; high-risk left edge. Reduced-motion safe.
- [x] 3.2 Home decision rows: hover lift + chevron slide. Reduced-motion safe.
- [x] 3.3 Proposal: recommended-option wash; high-risk header/container accent.
- [x] 3.4 DecisionCard: recommended-chip wash; new-card accent ring.

## 4. Markup

- [x] 4.1 Inbox: conditional high-risk row class; chevron icon on the row.
- [x] 4.2 Proposal: conditional rec-wash class on the recommended option; high-risk header class.
- [x] 4.3 DecisionCard: conditional rec-wash class on the recommended chip; new-card class.

## 5. Verify

- [x] 5.1 `npm test`, `npx tsc -b`, `npx eslint .` (touched files), `npx prettier --write`.
