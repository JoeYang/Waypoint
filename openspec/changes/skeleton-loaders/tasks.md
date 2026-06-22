# Tasks

## 1. Reusable Skeleton component

- [ ] 1.1 Write `Skeleton.test.tsx` (red): a default skeleton renders a single decorative element
      (`aria-hidden="true"`); a `lines={N}` skeleton renders N line elements; dynamic width/height are
      applied as inline style.
- [ ] 1.2 Add `Skeleton.module.css` (axiom tokens): block + line shimmer; shimmer keyframes disabled
      under `prefers-reduced-motion: reduce`.
- [ ] 1.3 Implement `Skeleton.tsx` (green): props `{ width?, height?, radius?, lines? }`, no `any`,
      dynamic sizing via inline style.

## 2. Wire skeletons into the loading states

- [ ] 2.1 Update `WaypointProvider.test.tsx` (red): the loading branch still exposes `role="status"`
      with an accessible "Loading…" name AND now renders skeleton placeholder(s).
- [ ] 2.2 Add an `.srOnly` visually-hidden helper to `provider-states.module.css`.
- [ ] 2.3 Provider loading branch: render an app-shell skeleton wrapped in `role="status"`
      `aria-busy="true"` + an sr-only "Loading…" text. Green.
- [ ] 2.4 Re-entry surfaces (`Briefing`, `MissionControl`, `TimelineDrawer`): replace the loading
      text with `Skeleton` rows, keeping `role="status"` + sr-only "Loading…". Add a re-entry loading
      test asserting the preserved status + skeletons.

## 3. Verify

- [ ] 3.1 `npm test`, `npx tsc -b`, `npx eslint .` (own files clean), `npx prettier --write`.
- [ ] 3.2 `npx openspec validate skeleton-loaders --strict`.
