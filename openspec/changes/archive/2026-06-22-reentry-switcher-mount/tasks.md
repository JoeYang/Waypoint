# Tasks

## 1. OpenSpec change

- [ ] 1.1 Author the proposal, this task list, and the `re-entry` spec delta (ADDED: re-entry surface
      selection; note the flat banner is superseded). `npx openspec validate reentry-switcher-mount
      --strict` passes.

## 2. Direction preference helper

- [ ] 2.1 Write `reentryPref.test.ts` (red): default is `"briefing"`; round-trips a saved direction;
      corrupt / unknown stored value falls back to default; a throwing storage degrades to default
      (load) and is a no-op (save) — never throws.
- [ ] 2.2 Implement `reentryPref.ts` (`loadDirection` / `saveDirection`, injectable storage, key
      `wp.reentry.direction`). Green.

## 3. Re-entry surface switcher + component

- [ ] 3.1 Add `ReentrySurface.module.css` (axiom tokens: segmented radiogroup switcher, trigger
      button; no inline styles).
- [ ] 3.2 Write `ReentrySurface.test.tsx` (red): the switcher renders all three options with Briefing
      selected by default; selecting Timeline then Mission control persists (re-read shows the choice)
      and renders the corresponding surface; the chosen surface auto-opens (content present) and can be
      closed, then reopened via the trigger; loading / error render the switcher without crashing.
- [ ] 3.3 Implement `ReentrySurface` ({ projectId }) over `useReentry`, `reentryPref`, and the three
      surface components. Green.

## 4. Mount + supersede

- [ ] 4.1 In `App.tsx` swap `<WhileYouWereAway />` (and its import) for `<ReentrySurface projectId=…
      />`, reading the project id from nav.
- [ ] 4.2 Remove `WhileYouWereAway.{tsx,module.css,test.tsx}`; grep the repo for stray references.

## 5. Verify

- [ ] 5.1 `npm test` (whole suite green), `npx tsc -b`, `npx eslint .` (own files clean),
      `npx prettier --write`.
- [ ] 5.2 `npx openspec validate reentry-switcher-mount --strict`.
