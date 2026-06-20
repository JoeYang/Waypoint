# Tasks

## 1. Full-surface walk (the daily test content)

- [ ] 1.1 `scripts/walk.ts` — ordered live-wire journey: get_context(empty) → create goal →
      activate → plans/tasks → park DECISION/QUESTION/PROPOSAL → REST inbox+progress assertions
      → answer each type → assume→confirm and assume→overturn → stale-version 409 →
      DONE/DISCARD → events tail → WS delta + resync → cross-project isolation → `/healthz`
- [ ] 1.2 Explicit assertions on ordering invariants + tail semantics (no wall-clock equality)
- [ ] 1.3 `npm run walk` (standalone, idempotent against a fresh seed)
- [ ] 1.4 `vitest.walk.config.ts` — `forks` pool suite wrapping the walk for CI reporting/retries
- [ ] 1.5 Matrix reporter: print which surfaces were exercised; non-zero exit on any failure

## 2. Fresh-setup dev compose (on-demand clean slate)

- [ ] 2.1 `docker-compose.dev.yml` — tmpfs Postgres + app image (reuse entrypoint migration) +
      one-shot seed service gated on `app: service_healthy`
- [ ] 2.2 Deterministic fixture seed driven over MCP (reuse the dogfood-over-MCP pattern)
- [ ] 2.3 `npm run env:fresh` / `env:down`; smoke check hits `/healthz` after `--wait`
- [ ] 2.4 Validate `podman-compose -f docker-compose.dev.yml up` brings the stack healthy

## 3. Orchestrator + daily routine

- [ ] 3.1 `scripts/test-routine.sh` — provision host `pg_ctl` (dev-db.sh) → start server →
      `npm test` → `npm run walk` → teardown; deterministic exit code
- [ ] 3.2 `npm run test:routine` wired to it
- [ ] 3.3 Daily Claude Code cron: run `test:routine`; on failure investigate + write a findings
      summary (no edits); notify pass/fail
- [ ] 3.4 Document the routine in `docs/testing-and-perf-routine-design.md` (cron + entry points)
