# Tasks

## 1. Thread the story through the hook

- [x] 1.1 Extend `useReentry.test.ts` (red): assert the ready model exposes a populated `timeline`
      (the story entries, oldest-first) and `sinceSeq` (the digest cursor). Keep the existing
      loading/error assertions green.
- [x] 1.2 Add `timeline: StoryEntry[]` and `sinceSeq: number` to `ReentryModel`, sourced from the
      already-fetched story response and the digest. Loading/error/ready contract unchanged. Green.

## 2. Timeline drawer surface

- [x] 2.1 Add `TimelineDrawer.module.css` (axiom tokens, right-side drawer, pinned needs-you header,
      session-replay list with time/label/node/actor rows, "new since you left" divider, footer).
- [x] 2.2 Write `TimelineDrawer.test.tsx` (red): ready renders a needs-you DecisionCard, a
      session-replay entry, and the "New since you left" divider (cursor 0 ⇒ all new ⇒ divider at
      top); "Enter session" acks the digest seq then calls `onClose`; loading + error (custom source
      whose `digest()`/`story()` rejects) states render.
- [x] 2.3 Implement `TimelineDrawer` ({ projectId, onClose }) over `useReentry` + `useWaypoint`.
      Green.

## 3. Verify

- [x] 3.1 `npm test`, `npx tsc -b`, `npx eslint .` (own files clean), `npx prettier --write`.
- [x] 3.2 `npx openspec validate reentry-timeline --strict`.
