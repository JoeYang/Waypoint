# Tasks

## 1. Home needs-you command bar

- [ ] 1.1 Rework `Home.module.css` (axiom tokens): needs-you command bar (large numeral + greeting +
      decision rows with Review buttons + all-caught-up state), demoted inline metrics strip, project
      card parked accent, segmented progress meter.
- [ ] 1.2 Update `Home.test.tsx` (red): command bar shows the "N waiting on you" count and a real
      decision title with a Review button that navigates + opens it; the demoted metrics strip
      renders; a project card shows its "Now — …" line and the segmented meter; a parked project gets
      the accent; the all-caught-up state renders when no decisions.
- [ ] 1.3 Rework `Home.tsx`: needs-you command bar, demoted metrics strip, reworked project cards.
      Green.

## 2. Verify

- [ ] 2.1 `npm test`, `npx tsc -b`, `npx eslint .` (own files clean), `npx prettier --write`.
- [ ] 2.2 `npx openspec validate home-command-bar --strict`.
