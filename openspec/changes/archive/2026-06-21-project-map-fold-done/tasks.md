# Tasks

## 1. Tests (red first)

- [x] 1.1 A done lane's task nodes are NOT visible by default
- [x] 1.2 Clicking a done lane's header reveals its task nodes (`aria-expanded` toggles)
- [x] 1.3 A non-done (active/blocked) lane's task nodes ARE visible by default

## 2. Implementation

- [x] 2.1 Make the lane header a real `<button>` with `aria-expanded`, keyboard operable
- [x] 2.2 Track expanded state with `useState` (a `Set` of stream ids); done lanes seed collapsed
- [x] 2.3 Skip rendering the `laneTrack` task nodes when the lane is collapsed
- [x] 2.4 Keep the header, badge, and `N/N done` summary visible when collapsed
- [x] 2.5 Add CSS-module styles for the header button (no inline styles except dynamic values)

## 3. Verify

- [x] 3.1 `npx vitest run packages/web/src/components/ProjectMap.test.tsx` is green
- [x] 3.2 `npx prettier --write` on changed files
- [x] 3.3 `openspec validate project-map-fold-done --strict` passes
