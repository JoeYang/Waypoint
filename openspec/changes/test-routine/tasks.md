# Tasks

## 1. Full-surface walk (the daily test content) — DONE

- [x] 1.1 `scripts/walk.ts` — ordered live-wire journey: get_context(empty) → create goal →
      activate → plans/tasks → park DECISION/QUESTION/PROPOSAL → REST inbox+progress assertions
      → answer each type → stale-version STALE_VERSION → DONE/DISCARD → events tail → WS delta
      (snapshot/upsert/removal) → cross-project isolation → NOT_FOUND → REST 404 → `/healthz`
- [x] 1.2 Explicit assertions on ordering invariants + tail semantics (no wall-clock equality)
- [x] 1.3 `npm run walk` (standalone, `--experimental-strip-types`, idempotent, best-effort cleanup)
- [x] 1.4 `vitest.walk.config.ts` — `forks` pool suite wrapping the walk (`npm run walk:ci`)
- [x] 1.5 Declared-surface set (27) — non-zero exit + named gaps on any silent miss
- [x] 1.6 Scope correction: ASSUMED→CONFIRMED/OVERTURNED is core-only (unrouted) and WS resync
      needs >256 events — both stay unit-tested, not walked. Recorded in the design doc + matrix.

## 2. Fresh-setup dev compose (on-demand clean slate) — DEFERRED

> The daily driver is host `pg_ctl` (user decision: robust unattended, no container daemon).
> The fresh compose is on-demand clean-slate verification, valuable but not on the daily path —
> deferred to a follow-up so the daily loop ships now. The orchestrator already gives a
> clean-slate DB per run (drop+create+migrate+seed).

- [ ] 2.1 `docker-compose.dev.yml` — tmpfs Postgres + app image (reuse entrypoint migration) +
      one-shot seed service gated on `app: service_healthy`
- [ ] 2.2 Deterministic fixture seed driven over MCP
- [ ] 2.3 `npm run env:fresh` / `env:down`; smoke check hits `/healthz` after `--wait`
- [ ] 2.4 Validate `podman-compose -f docker-compose.dev.yml up` brings the stack healthy

## 3. Orchestrator + daily routine — DONE

- [x] 3.1 `scripts/test-routine.sh` — isolated throwaway DB (`waypoint_routine`) + server on
      dedicated ports (18848/18849) → build server chain → migrate → full unit+integration suite
      (382/382, 0 skipped) → seed → walk → trap teardown. Never touches the dev stack.
- [x] 3.2 `npm run test:routine` wired to it
- [x] 3.3 `scripts/daily-routine.sh` (`npm run routine:daily`) — run + capture log + distil a
      Claude-readable `reports/test-routine/<date>.md` + notify; changes no code. The Claude Code
      routine (user-scheduled) reads the report and triages failures (no edits, no PR).
- [x] 3.4 Documented in `docs/testing-and-perf-routine-design.md` §5.5 (as-built) + corrected
      walk scope (§5.2) and coverage matrix (§9)
