# Tasks

## 1. Self-seeding + healthcheck + pinned base

- [ ] 1.1 Entrypoint: run the idempotent default-project seed after migrations (fresh volume
      is usable immediately; existing data untouched via ON CONFLICT DO NOTHING)
- [ ] 1.2 `docker-compose.prod.yml`: app-service healthcheck hitting `/healthz`
- [ ] 1.3 Dockerfile: pin `node:22-slim` by digest (both stages)

## 2. Versioned deploy + rollback

- [ ] 2.1 `scripts/deploy.sh`: build from clean HEAD → tag `:<sha>` + `:latest` → recreate →
      wait `/healthz` → report. Keeps SHA-tagged images for rollback.
- [ ] 2.2 `npm run deploy` wired to it; rollback documented (`deploy.sh <old-sha>` / retag)
- [ ] 2.3 Does not echo `WAYPOINT_DB_PASSWORD`

## 3. Backups + secrets hygiene

- [ ] 3.1 `scripts/prod-backup.sh`: `pg_dump` the prod container DB → `backups/` (timestamped,
      pruned to N); documented restore
- [ ] 3.2 `.env.example` committed; confirm `.env` git-ignored; document podman-secret + rotation

## 4. Validate

- [ ] 4.1 Dogfood `deploy.sh` to ship the hardened image; verify `/healthz`, `default` present,
      `register_project` still live, data intact
- [ ] 4.2 Run `prod-backup.sh`; verify a dump lands and prunes
