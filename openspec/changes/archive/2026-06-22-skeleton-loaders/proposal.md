# Skeleton loading states

## Why

Now that the web app is live-wired (the `WaypointSource` may be the async backend), every async view
spends real time in its loading branch — but each one currently renders a bare line of text
("Loading…" in the provider shell, "Catching you up…" in the re-entry surfaces). The UI review (item
7) flagged this as a jarring layout shift: the human stares at one centered word, then the full
layout snaps in when data arrives. The established pattern for this is a **skeleton placeholder** — a
low-fidelity shimmer that approximates the incoming layout so the eye has something stable to anchor
on and the content swap is calm rather than abrupt.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this only
changes what the existing loading branches render; the data seam (`useWaypoint`, `useReentry`,
`WaypointSource`) is untouched.

- **New reusable `Skeleton` component** (`packages/web/src/components/Skeleton.tsx` + CSS module): a
  presentational shimmer placeholder. Props `{ width?, height?, radius?, lines? }` — a single block,
  or `N` stacked line bars when `lines` is given. It is decorative, so it carries `aria-hidden="true"`
  and contributes nothing to the accessibility tree. The shimmer animation is disabled under
  `prefers-reduced-motion: reduce`.
- **Provider loading branch** renders a lightweight app-shell skeleton (a column of `Skeleton` blocks
  approximating sidebar + content) instead of the bare "Loading…" text. The skeleton is wrapped in an
  element with `role="status"` + `aria-busy="true"` plus a visually-hidden ("sr-only") "Loading…"
  text, so screen-reader users and tests still detect the loading state through an accessible name.
- **Re-entry surfaces** (`Briefing`, `MissionControl`, `TimelineDrawer`) replace the "Catching you
  up…" text in their loading branch with a few `Skeleton` rows, again wrapped so the loading state
  keeps `role="status"` + a visually-hidden "Loading…" accessible name.
- **`.srOnly` helper** (visually-hidden but still in the accessibility tree) is added to the shared
  `provider-states.module.css` so the accessible loading text can be present without being visible.

The accessible loading signal is preserved in **every** case: each loading state remains assertable
by `role="status"` and an accessible "Loading…" name, so screen readers announce it and tests detect
it — the skeleton is purely the visible decoration layered on top.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- Added: `packages/web/src/components/Skeleton.tsx`, `Skeleton.module.css`, `Skeleton.test.tsx`.
- Changed: `packages/web/src/wp/WaypointProvider.tsx`, `provider-states.module.css`,
  `packages/web/src/components/{Briefing,MissionControl,TimelineDrawer}.tsx` and their `.module.css`,
  plus the loading-text assertions in `WaypointProvider.test.tsx` (updated to assert the preserved
  accessible loading signal, not the literal text).
