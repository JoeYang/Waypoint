# Enrich the while-you-were-away digest

## Why

The re-entry UI uplift (see `docs/superpowers/specs/2026-06-21-waypoint-ui-uplift-reentry-design.md`)
needs the digest to carry signal it does not surface today: each waiting decision's risk and
whether it is *new since you left*, where each agent is working *now*, the careful-eye "heads up"
items, and a tally for a segmented progress meter. All of it is already derivable from the
append-only event log + the per-principal cursor — it is simply not projected into the wire DTO,
so every re-entry surface (Briefing/Mission/Timeline, the home command bar, the map) would
otherwise each re-derive it client-side from raw inbox/progress reads.

## What Changes

Additive, back-compatible enrichment of the digest projection — **no MCP-tool contract change and
no DB schema change** (a wire-DTO widening only):

- `DigestAsk` gains **`risk`** and **`reversible`** (already on `Ask`, surfaced on the waiting row)
  and **`isNew`** — true when the ask was parked within the unseen window (`seq > sinceSeq`), the
  "NEW vs Seen" / "new since you left" signal, derived from the cursor, not stored.
- `Digest` gains **`activeWork[]`** — where agents are *now*, derived from the current node
  snapshot (a task that is `ACTIVE` and not blocked-on-ask). It names the **task**, never a file
  path: Waypoint has no agent file-cursor signal, and adding one is a separate MCP-contract change.
- `Digest` gains **`headsUp[]`** — open asks that need a careful eye, derived purely from
  **irreversible or high-risk** open asks (`kind:"danger"` when irreversible, else `"warning"`).
  There is no "test failed" event in the model, so failing-test heads-up is out of scope.
- `Digest` gains **`tallies`** — `{done, active, parked, queued}` counts over task-kind nodes for
  the segmented progress meter; discarded nodes excluded.

The derivation stays in `projectDigest` (pure, unit-tested). The core use-cases already spread
`...buckets` and the REST route is a passthrough, so the server needs no logic change — only the
wider DTO. Web mock fixtures are extended to satisfy the wider type; **no component/UI change in
this slice**.

## Impact

- **No ask-first gate:** no MCP tool contract change, no DB schema/migration. The DTO widening is
  additive and back-compatible.
- Unblocks the web slices (S2–S7) which all read these fields.
- `packages/shared/src/reentry.ts` (DTO), `packages/core/src/reentry.ts` (`projectDigest`),
  `packages/web/src/wp/{source,fixtures}.ts` (mock fixtures kept green). No new dependencies.
