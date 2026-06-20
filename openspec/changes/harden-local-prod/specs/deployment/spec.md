# deployment

## ADDED Requirements

### Requirement: Self-seeding on a fresh volume

The production container SHALL ensure the default project exists on startup, so a brand-new
database volume is usable without a manual seed or data restore.

#### Scenario: Fresh volume is immediately usable

- **WHEN** the app container starts against an empty (migrated) database
- **THEN** the default project is seeded idempotently before the server accepts requests
- **AND** an agent's `get_context` / `create_node` against the default project succeeds

#### Scenario: Existing data is preserved

- **WHEN** the container restarts against a database that already has data
- **THEN** the seed is a no-op (ON CONFLICT DO NOTHING) and no existing row is changed

### Requirement: App healthcheck

The production stack SHALL report the app container's health by probing `/healthz`, since the
image-level HEALTHCHECK is not honoured under the rootless-podman OCI build.

#### Scenario: Health is observable

- **WHEN** the app container is running and serving
- **THEN** the compose stack reports it healthy via a `/healthz` probe, and unhealthy when the
  probe fails

### Requirement: Versioned, reversible deploy

The system SHALL provide a deploy command that builds the image from a clean committed tree,
tags it with the git revision, recreates the stack, and verifies health — retaining prior
tagged images so a previous revision can be redeployed.

#### Scenario: Deploy tags by revision

- **WHEN** the deploy command runs at commit `<sha>`
- **THEN** it builds `localhost/waypoint:<sha>` (and `:latest`), recreates the stack, and exits
  only after `/healthz` returns ok

#### Scenario: Rollback to a prior revision

- **WHEN** a previously built `:<sha>` image is redeployed
- **THEN** the stack runs that revision without rebuilding

### Requirement: Production database backups

The system SHALL provide a backup command that captures the production container's database to
a local, timestamped, pruned archive, with a documented restore.

#### Scenario: Backup captures and prunes

- **WHEN** the backup command runs
- **THEN** a timestamped dump of the prod database is written and older dumps beyond the
  retention count are removed
