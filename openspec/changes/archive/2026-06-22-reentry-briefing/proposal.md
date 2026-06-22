# Re-entry Briefing surface

## Why

The re-entry UI uplift (`docs/superpowers/specs/2026-06-21-waypoint-ui-uplift-reentry-design.md`)
ships three switchable re-entry surfaces — Briefing, Mission, Timeline — over the same enriched
digest (`enrich-digest-projection`, already merged). The existing `WhileYouWereAway` banner is the
fourth, terse, always-visible form; these three are the richer, modal "catch me up" experiences.

This slice (S3a) lands the **first surface, Briefing**, plus the shared **data hook** the other two
surfaces will reuse. The Briefing is a centered modal that greets the returning human, leads with
the decisions that need them (each an inline, actionable `DecisionCard`), then summarizes where the
agent is now, what moved, and any heads-up. It is the calm "here's your morning" view.

Splitting the hook from the surface keeps each surface thin: the hook owns the async fetch +
digest/story → view-model mapping (loading / error / ready), and every surface just renders the
ready model. S3b (Mission/Timeline) and S3c (the switcher + mount) consume this hook unchanged.

## What Changes

Web-only. **No MCP-tool contract change, no REST DTO change, no DB schema change** — this reads the
already-enriched digest + story through the existing `WaypointSource` seam.

- **`useReentry(projectId)`** (`packages/web/src/wp/useReentry.ts`) — calls the provider's
  `digest()` + `story()` on mount and returns a discriminated state:
  `{status:"loading"} | {status:"error", retry} | {status:"ready", model}`. The `model` maps the
  enriched digest + story + the project's `decisions` into a surface-ready shape: a greeting
  (project + user name), `needsYou` (the project's open decisions, each flagged `isNew` when a
  matching `digest.waiting` entry by `askId` is new), `activeWork`, `moved` (shipped), `headsUp`,
  `tallies`, and `seq` (for ack). Digest/story rejection → the error state with a retry.
- **`Briefing`** (`packages/web/src/components/Briefing.tsx`) — a centered modal
  (`role="dialog"`, `aria-label="While you were away"`) rendering, via `useReentry`: a greeting
  header counting decisions needing the human; a "Needs you" section embedding `DecisionCard` per
  item (or an "all clear" line when none); "Where your agent is now"; "What moved"; "Heads up"
  (danger/warning styled); and a primary "Jump into the session" button that acks the digest seq,
  then calls `onClose`. Three states: loading, error (message + Retry), ready.

This slice does **not** touch `App` or `WhileYouWereAway` — the surface switcher and the mount land
in a later slice (S3c). The Briefing is exercised in isolation by its test for now.

## Impact

- **No ask-first gate:** no MCP contract, no DB schema, no new dependency.
- New: `packages/web/src/wp/useReentry.ts` (+ test), `packages/web/src/components/Briefing.tsx`
  (+ `.module.css`, + test). Reuses `DecisionCard`, the `WaypointProvider` seam, and the axiom
  tokens. Consumed by S3b and S3c.
