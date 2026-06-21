# Harden the local production container

## Why

Waypoint runs in a container, but the deployment is hand-operated and fragile in ways that
bite on the next fresh start or update:

- The image is built ad-hoc as `:latest` only — no version, no record of what's running, no
  rollback.
- A **fresh volume has no `default` project** — the entrypoint migrates but never seeds, so
  `get_context("default")` / `create_node` fail until someone manually restores data.
- The app has **no healthcheck** under podman (the image `HEALTHCHECK` is dropped by the OCI
  build format), so a wedged-but-listening server is invisible.
- The base image is an **unpinned tag** (`node:22-slim`) — non-reproducible builds.
- The **prod volume has no backups** — the only copy is a one-off manual dump.

This closes those gaps so the local prod instance is reproducible, self-seeding, observable,
and recoverable. Scope is **local rootless podman only** — auth, CI/registry, and a
containerized dev stack are explicitly out of scope (separate, larger efforts).

## What Changes

- **Seed on start**: the entrypoint runs the idempotent default-project seed after migrations,
  so a brand-new volume is immediately usable with no manual restore.
- **App healthcheck**: `docker-compose.prod.yml` gains an app-service healthcheck hitting
  `/healthz` (compose-level, since the image directive is dropped under podman).
- **Pinned base**: the Dockerfile pins `node:22-slim` by digest for reproducible builds.
- **Versioned deploy**: `scripts/deploy.sh` builds from a CLEAN committed tree, tags the image
  with the git SHA (+ `latest`), recreates the stack, and verifies health — keeping prior
  SHA-tagged images so a rollback is `deploy.sh <old-sha>`.
- **Volume backups**: `scripts/prod-backup.sh` dumps the prod container's database (timestamped,
  pruned), with a documented restore path.
- **Secrets hygiene**: a committed `.env.example`; `.env` stays git-ignored; the deploy script
  does not echo the password; podman-secret + rotation documented as the next step.

## Impact

- **Deployment/ops files only** (Dockerfile, entrypoint, prod compose, new scripts) — no
  app/domain code change, no new runtime deps.
- Targets local rootless podman; the same files still work under Docker.
- **Out of scope** (flagged, not done here): authn/authz (only needed off localhost), CI +
  image registry, and the on-demand `docker-compose.dev.yml`.
