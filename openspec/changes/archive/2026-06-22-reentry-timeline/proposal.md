# Re-entry Timeline surface

## Why

The re-entry UI uplift (`docs/superpowers/specs/2026-06-21-waypoint-ui-uplift-reentry-design.md`)
ships three switchable re-entry surfaces — Briefing, Mission Control, Timeline — over the same
enriched digest (`enrich-digest-projection`, merged) and the project story, read through the shared
`useReentry` hook (`reentry-briefing` + `reentry-mission-control`, merged). The Briefing is the calm
centered "here's your morning"; Mission Control is the whole-picture command deck.

This slice (S3c) lands the **third surface, Timeline**: a right-side drawer that replays the session
as a chronological feed of what happened while the human was away. Where the other surfaces summarize
state, the Timeline is the narrative — the project story read back as "who did what, to which node",
oldest-first, with a "new since you left" boundary marking the first entry past the human's last-seen
cursor. It pins the decisions that still need the human at the top (the same actionable
`DecisionCard`), so the act surface is identical across re-entry modes.

The story is already fetched by `useReentry` (it fetches the digest + story on mount) but the model
discards it. This slice threads the story through the model so the Timeline can render it, alongside
the digest's `sinceSeq` cursor for the boundary divider. The hook change is purely additive — the
Briefing and Mission Control surfaces are untouched.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this reads the
already-fetched story and the enriched digest through the existing `WaypointSource` seam.

- **`useReentry`** (`packages/web/src/wp/useReentry.ts`) — add two fields to the ready `ReentryModel`,
  both sourced from data the hook already fetches:
  - `timeline: StoryEntry[]` — the story response entries, oldest-first as returned.
  - `sinceSeq: number` — the digest's `sinceSeq` cursor (0 = never visited), for the "new since you
    left" boundary. The loading/error/ready contract is unchanged; the Briefing and Mission Control
    surfaces continue to read the model fields they already use.
- **`TimelineDrawer`** (`packages/web/src/components/TimelineDrawer.tsx`) — a right-side drawer
  (`role="dialog"`, `aria-label="While you were away"`) rendering, via `useReentry`:
  - A pinned **"Needs you · {count}"** header section with a `DecisionCard` per open decision (or an
    all-clear line when none).
  - A **"Session replay"** list of `timeline` entries: each shows a HH:MM time derived from `at`, a
    label from `summary ?? verb`, the `nodeTitle`, and `actorLabel` when present. A **"New since you
    left"** divider is rendered immediately before the first entry whose `seq > sinceSeq` (at the top
    when the cursor is 0 / all entries are new; omitted entirely when no entry is new).
  - A primary **"Enter session"** button that acks the digest seq, then calls `onClose`.
  - Three states: loading, error (message + Retry), ready.

This slice does **not** touch `App`, `WhileYouWereAway`, or the surface switcher — the switcher +
mount land in S3d. The Timeline is exercised in isolation by its test for now.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- Changed: `packages/web/src/wp/useReentry.ts` (additive: two new model fields) + its test.
- New: `packages/web/src/components/TimelineDrawer.tsx` (+ `.module.css`, + test). Reuses
  `useReentry`, `DecisionCard`, the `WaypointProvider` seam (`ackDigest`), and the axiom tokens.
  Consumed by S3d.
