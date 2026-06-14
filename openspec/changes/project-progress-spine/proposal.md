## Why

The second founder goal is unbuilt: now that humans are _in and out_ of the loop, there must be a way
to track project progress on three levels — **goal → plan → task** — or it is too hard to re-gather
context on return. V1 has only a flat queue of questions and no sense of _where we are_.

This change is **slice 2 of the V2 arc**. It makes the live project the primary surface: the home
screen becomes the goal → plan → task **spine**, showing where each agent is working and what is blocked,
and the inbox is repositioned as a **lens** over it ("just show me what needs me") rather than the front
door. It builds on the enriched, self-contained card from slice 1 by re-homing it in the spine, in place
on the task it blocks.

## What Changes

- Add a three-level **progress read model** (`listProject`): each goal, plan, and task carries explicit
  state and rolled-up counts, computed in one transaction with no N+1 from data already stored.
- Add the **project spine** web screen as the home: a fixed goal header, plan sections with progress,
  and tasks beneath them; asks appear in place on the task they block. Importance (blast radius) is shown
  as visual weight, not as a sort key. The tree collapses to the live edge by default to stay glanceable.
- Reposition the **inbox as a saved lens** over the project — the same ranked asks, filtered to "needs
  you," reachable from the spine — not a separate home.

## Capabilities

### Added Capabilities

- `project-progress`: a read model and a web spine that expose the goal → plan → task hierarchy with
  per-level state and rolled-up progress, so a returning human re-acquires context at a glance and asks
  are answered in the context of the work they block.

### Modified Capabilities

- `inbox`: becomes a lens (a saved filter) over the project spine rather than the application's home;
  asks are presented in the context of their task node.

## Impact

- **Schema**: none required initially — states are derived from existing node `status`, ask state, and
  `depends_on` edges. Blast radius is **direct dependents only** (a bounded, cheap count), so the cost is
  not transitive closure; the real cost is the per-level aggregation and the ancestor walk.
- **Rollup strategy (owned in this slice, not deferred)**: the spine is the home screen, so its read
  performance is a first-class design decision _here_, not a later patch. The plan: implement the
  read-time rollup, then **measure it against a realistic tree (50+ tasks, a non-trivial dependency
  graph) under an interactive budget**. If read-time misses the budget, fall back to a **denormalized
  projection updated on event append** — consistent with the append-only model (the same event that
  drives the WS delta updates the projection). Pros/cons: read-time is simpler and has no
  invalidation risk but is unproven at scale; the write-time projection is bounded on read but adds an
  invalidation surface. Decide from the measurement before building the spine UI on top.
- **Code**: `shared` gains the `ProjectProgress` DTO; `core` gains `listProject` (one transaction, no
  N+1, cycle-guarded hierarchy walk); `server` adds `GET /v1/projects/:id/progress`; `web` adds the spine
  screen as home and demotes the inbox to a lens. The existing WebSocket delta drives live re-rank and
  the settle/dim of completed work. No new transport; import direction unchanged.
- **Design constraint**: the spine MUST stay calm and glanceable — collapse to the live edge by default;
  only change moves; the goal is fixed; no charts.
- **Depends on**: slice 1's self-contained card (re-homed in place).
- **Out of scope (slice 3)**: the while-you-were-away story, the threaded event narrative, and tiered
  notifications.
