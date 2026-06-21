# Tasks

## 1. Self-seeding + healthcheck + pinned base — DONE

- [x] 1.1 Entrypoint runs the idempotent default-project seed after migrations (verified in
      logs: `migrations → ensuring default project → starting server`)
- [x] 1.2 `docker-compose.prod.yml` app healthcheck hitting `/healthz` — via a script file
      (`docker/healthcheck.js`), since podman-compose mangles an inline `node -e` into broken
      `/bin/sh`. Container reports `(healthy)`.
- [x] 1.3 Dockerfile pins `node:22-slim` by digest (`@sha256:689c11…`, both stages)

## 2. Versioned deploy + rollback — DONE

- [x] 2.1 `scripts/deploy.sh`: build from clean HEAD → tag `:<sha>` + `:latest` → recreate →
      wait `/healthz`. Verified: shipped `:f4a2a98` then `:d948e8b`; prior SHA tag retained.
- [x] 2.2 `npm run deploy` wired; rollback = `scripts/deploy.sh <sha>` (retag, no rebuild)
- [x] 2.3 Does not echo `WAYPOINT_DB_PASSWORD` (compose output logged + scrubbed)

## 3. Backups + secrets hygiene — DONE

- [x] 3.1 `scripts/prod-backup.sh` (`npm run prod:backup`): `pg_dump` the prod container DB →
      `backups/`, timestamped + pruned, restore documented. Verified (32K dump written).
- [x] 3.2 `.env.example` present + `.env` git-ignored; deploy doesn't echo the secret;
      podman-secret + rotation documented (actual password rotation deferred — internal-only DB,
      not host-exposed)

## 4. Validate — DONE

- [x] 4.1 Dogfooded `deploy.sh`: `/healthz` ok, `default` present, data intact (default +
      trading-universe), both containers `(healthy)`
- [x] 4.2 `prod-backup.sh` writes + prunes a dump
