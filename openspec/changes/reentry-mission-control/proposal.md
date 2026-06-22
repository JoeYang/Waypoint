# Re-entry Mission Control surface

## Why

The re-entry UI uplift (`docs/superpowers/specs/2026-06-21-waypoint-ui-uplift-reentry-design.md`)
ships three switchable re-entry surfaces — Briefing, Mission Control, Timeline — over the same
enriched digest (`enrich-digest-projection`, merged) read through the shared `useReentry` hook
(`reentry-briefing`, merged). The Briefing is the calm, centered "here's your morning" view.

This slice (S3b) lands the **second surface, Mission Control**: a full-screen takeover for the
human who wants the whole picture at once. Where the Briefing is a narrow column, Mission Control
is a 3-column command deck — what needs you on the left, where things stand now in the middle, what
moved on the right — capped by a footer stat strip and a single "Enter session" action. It reuses
`useReentry` unchanged and embeds the same actionable `DecisionCard` per open decision, so the act
surface is identical across re-entry modes.

Building it on the existing hook keeps the surface thin: the hook owns the async fetch +
digest/story → view-model mapping (loading / error / ready); Mission Control is pure presentation,
plus one derived view — per-stream progress computed from the project's `streams` in the live data
snapshot (done tasks over total tasks). S3c (the switcher + mount) consumes this surface unchanged.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this reads the
already-enriched digest through the existing `WaypointSource` seam and the project's `streams` from
the existing data snapshot.

- **`MissionControl`** (`packages/web/src/components/MissionControl.tsx`) — a full-screen takeover
  (`role="dialog"`, `aria-label="While you were away"`) rendering, via `useReentry`:
  - A **top bar**: greeting ("Welcome back, {userName}" + the project name) and a "Skip to session"
    button that calls `onClose`.
  - A **3-column body**: (a) "Needs you — act here" — a `DecisionCard` per `needsYou` item (or an
    all-clear line when none) plus a "Heads up" sub-section listing `headsUp` (danger vs warning
    styling); (b) "Where things stand now" — `activeWork` as "{streamTitle} — {nodeTitle}" lines
    plus a "Streams" mini-list with a per-stream progress bar derived from the live project's
    `streams` (done = tasks with `status === "done"`, total = `tasks.length`); (c) "While you were
    away" — the `moved` titles as a feed.
  - A **footer stat strip**: "{needsYou} need you", "{activeWork} agents live", "{moved} shipped
    while away", "{headsUp} to check", and a primary "Enter session" button that acks the digest
    seq, then calls `onClose`.
  - Three states: loading, error (message + Retry), ready.

This slice does **not** touch `App`, `WhileYouWereAway`, or the surface switcher — those land in
S3c. Mission Control is exercised in isolation by its test for now.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- New: `packages/web/src/components/MissionControl.tsx` (+ `.module.css`, + test). Reuses
  `useReentry`, `DecisionCard`, the `WaypointProvider` seam (`data` for streams, `ackDigest`), and
  the axiom tokens. Consumed by S3c.
