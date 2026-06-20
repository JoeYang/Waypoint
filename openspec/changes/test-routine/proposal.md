# Test routine — fresh env, full-surface walk, daily loop

## Why

The suite proves pieces in isolation (Vitest unit/integration) and one happy path
(Playwright hero-loop), but nothing walks the whole capability surface against the live wire,
there is no one-command fresh full-stack environment, and nothing runs any of it on a
schedule. We want a repeatable **daily** signal that the whole product works end-to-end —
all 4 MCP tools, all 6 REST routes, the WS path, and the full node/ask lifecycle — so
regressions surface the morning after they land, not at the next demo. Design: see
`docs/testing-and-perf-routine-design.md` (§5, §7, §10 slices 1, 3, 6).

## What Changes

- A fresh-setup full-stack environment **`docker-compose.dev.yml`** — ephemeral (tmpfs)
  Postgres + the existing app image (MCP + REST/WS + web), migration via the **existing
  entrypoint** (no double-migrate), deterministically seeded over MCP only after the app is
  healthy. On-demand for clean-slate verification; not the daily driver.
- A **full-surface walk** (`scripts/walk.ts`) — one ordered journey over the live MCP + REST
  + WS surface exercising all 4 MCP tools, all 6 REST routes + `/healthz`, the node and ask
  lifecycles (incl. assume→confirm/overturn and DISCARD), an optimistic-concurrency conflict,
  cross-project isolation, WS delta/resync, and the events-tail semantics. Runnable standalone
  (`npm run walk`) and as a Vitest `forks`-pool suite.
- An orchestrator **`npm run test:routine`** — provisions a host `pg_ctl` Postgres
  (`dev-db.sh`), starts the server, runs `npm test` + the walk, then tears down. Container-free
  for unattended robustness.
- A **daily Claude Code routine** that runs `test:routine` and, on failure, investigates and
  writes a findings summary (root cause + suspected `file:line`, **no code changes**), then
  notifies the result.

## Impact

- New **dev-only** tooling. No change to `core`/`server`/`web` production code — unless the
  walk surfaces a real bug, in which case a red test precedes the fix (its own commit).
- **No new runtime dependencies.** `docker-compose.dev.yml` reuses the existing `Dockerfile`;
  the walk uses the already-present MCP SDK + `ws`.
- The daily run executes on the **host** (`pg_ctl`), not containers — robust unattended,
  avoiding container-daemon flakiness. `docker-compose.dev.yml` is validated on-demand.
- Follow-ups (separate changes): L2 coverage gaps, the failure-injection lane, and the k6
  performance suite (design §5.1, §5.4, §6).
