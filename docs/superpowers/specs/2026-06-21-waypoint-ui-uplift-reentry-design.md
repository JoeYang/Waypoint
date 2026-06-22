# Waypoint — UI uplift + rich re-entry (epic design)

**Date:** 2026-06-21 · **Status:** approved (roadmap) · **Source designs:** `claude.ai/design`
project *Waypoint UI* — `Waypoint UI Review.html` (12-point before/after critique) and
`Waypoint Re-entry.html` (working prototype, 3 switchable directions).

## Problem

The shipped v1 ports the prototype faithfully but reads *flat*: everything sits at one
elevation and one weight, so the screen rarely tells you what matters most or where the work
is. The two designs fix this by spending hierarchy on the **async re-entry moment** (surface
the actual parked decisions; show where each agent is *now*) and by making the project map read
as **parallel streams in motion** rather than stacked checklists.

## Scope (chosen)

All three re-entry directions (switchable), all 12 UI-review points, full-stack each feature
(backend projection → server emit → web). Independently reviewed; the review's ordering and
naming corrections are folded in below.

## What the backend emits today vs. what the designs need

| Design need | Today | Plan |
|---|---|---|
| Per-decision `risk` / `reversible` on the digest | on `Ask`, not on `DigestAsk` | surface in S1 |
| "NEW since you left" per decision | cursor exists (`principal_cursor`), no `isNew` on DTO | derive in S1 (`seq > sinceSeq`) |
| "Now — working on «task»" | **no agent file-cursor at all** (`sessionId` is provenance) | S1 `activeWork`, derived from the **active node** — names the task, never a file path |
| Heads-up (careful-eye items) | not modelled; no "test failed" event | S1 `headsUp`, derived from **irreversible / high-risk open asks** only |
| Segmented progress meter (done/active/parked/queued) | states derivable, no tallies | S1 `tallies` over task nodes |
| Per-option `recommended` flag | options are `{id,label,consequence?}` | S8 (MCP-contract gate) — until then "first option = default" |

**Explicitly cut (YAGNI / data does not exist):** a real file-level agent cursor (becomes
"working on «task»"); any "test failed" heads-up (no such event in the model).

## Decomposition — 8 OpenSpec slices (dependency-ordered)

```
S1 enrich-digest-projection  (DTO change, NOT an ask-first gate)
     shared DTO → core projection → server passthrough → web fixtures green
     +isNew (cursor-derived) +risk/reversible on waiting +activeWork +headsUp +tallies
        │ unblocks every web slice
        ├──────────────┬───────────────┬───────────────┐
        ▼              ▼               ▼               ▼
   S2 DecisionCard  S4 map-spine    S6 home-cmd-bar  S7 polish 7–12
   (shared widget)  (3 PRs)                          (per-item PRs)
        │
        ▼
   S3 three re-entry directions: Briefing → Mission Control → Timeline

   S8 ask-recommended-option  ⚠ ASK-FIRST (MCP park_ask contract; options jsonb, no DDL)
      LAST — only enables the recommended-option accent wash
```

Data-flow for the S1 derived fields — all pure projections over the existing append-only event
log + `principal_cursor`, never a stored column:

```
event log (per-project seq) ─┬─ seq > sinceSeq ─────────────────► DigestAsk.isNew
                             ├─ ask.parked + open & (!reversible│high risk) ► headsUp[]
node snapshot ───────────────┼─ task ACTIVE & not blocked-on-ask ► activeWork[] "Now — «task»"
                             └─ task nodes by derived state ─────► tallies{done,active,parked,queued}
ask.risk / ask.reversible (already stored) ────────────────────► DigestAsk.risk / .reversible
```

## Key design decisions (with rationale)

- **`activeWork`, not `positions`/file cursor.** Waypoint has no agent file-position signal and
  adding one is a new MCP tool + event verb + a writer in every harness — out of scope for
  design polish. Deriving "working on «task»" from the active node is honest and free. Pro:
  ships now, no contract change. Con: no `seed.ts`-level detail (acceptable — the task title is
  the actionable fact).
- **The one ask-first gate (S8) goes last.** The per-option `recommended` flag is the only
  contract change in the epic and it blocks nothing except one cosmetic accent wash. Sequencing
  it last keeps the human-approval gate off the critical path; until it lands the UI treats the
  first option as the default. Pro: web track never stalls on an approval. Con: the wash is the
  last thing to land (fine — it is the least important).
- **Three directions, Briefing first.** The user chose all three; we *sequence* Briefing first
  (closest to today's banner) with Mission Control and Timeline as fast-follows behind the
  switcher, so each is independently shippable and the product choice can be made on live data.
- **Re-slice web by component, not by screen.** "3 directions + DecisionCard" and "map spine"
  each exceed the ~600-line PR cap; they split into DecisionCard → each direction, and rail →
  inline-parked → meters/collapse/summary.

## S1 contract (this slice)

Additive, back-compatible DTO additions in `packages/shared/src/reentry.ts`:

- `DigestAsk` gains `risk: Risk`, `reversible: boolean`, `isNew: boolean`.
- `Digest` gains `activeWork: DigestActiveWork[]`, `headsUp: DigestHeadsUp[]`, `tallies: DigestTallies`.
- New shapes: `DigestActiveWork {nodeId,nodeTitle,kind,streamId,streamTitle}`,
  `DigestHeadsUp {askId,nodeId,nodeTitle,prompt,risk,reversible,kind:"danger"|"warning"}`,
  `DigestTallies {done,active,parked,queued}`.

Derivation lives in `projectDigest` (`packages/core/src/reentry.ts`), pure and unit-tested. The
core use-cases (`digest`, `digestFor`) already spread `...buckets`, and the REST route is a
passthrough, so the server needs no logic change — only the wider DTO. Web mock fixtures are
extended to satisfy the wider type (no component/UI change in S1).

**Testing (TDD red-first):** contract test for the new schema fields; core unit tests for each
derived field — `isNew` boundary at the cursor, `risk`/`reversible` passthrough, `activeWork`
excludes blocked/done/draft, `headsUp` includes only irreversible/high-risk open asks with the
right `kind`, `tallies` count each state and exclude discarded; failure paths (empty project,
unknown node titles, very long absence bounded by `REENTRY_PAGE_MAX`).

## Per-slice status

- **S1** enrich-digest-projection — *in progress* (this doc + OpenSpec `enrich-digest-projection`).
- S2 DecisionCard · S3 re-entry directions · S4 map spine · S6 home command bar ·
  S7 polish 7–12 · S8 ask-recommended-option — planned, each its own OpenSpec change + PR.
