---
paths: ["packages/server/src/ws/**", "packages/web/src/**/useWaypointStream*", "packages/web/src/**/*Stream*"]
---
# WebSocket Rules

The UI is push-driven: the inbox re-ranks live, it does not poll.

## Connection lifecycle
- One connection per browser session, scoped to a project (or all-projects for the aggregated inbox).
- Authenticate/identify on connect (project scope); reject unscoped connections once auth lands.
- Heartbeat ping/pong; detect dead connections and clean up server-side subscriptions.

## Reliability
- Every event carries the per-project `seq`. On reconnect the client sends its last `seq`;
  the server replays everything since (`resume-since-seq`) — no missed or duplicated deltas.
- **Delta-only**: push only the asks/nodes whose `blocked`/`blast_radius`/state actually
  changed, never the full inbox. The server diffs against the materialized cache.
- Back-pressure: bound the per-connection outbound queue; drop-to-resync (send "refetch")
  rather than unbounded buffering.

## Discipline
- The WS layer is a transport adapter — it carries domain events, holds no domain logic.
- Idempotent client handlers: applying the same `seq` twice is a no-op.
- Test: dropped connection mid-answer, out-of-order frames, reconnect gap, server restart.
