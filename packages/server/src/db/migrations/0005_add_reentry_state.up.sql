-- async-reentry-and-notifications (V2 slice 3): supporting state for the re-entry digest and the
-- tiered notifier. Neither table is the event log — the log stays append-only and untouched; the
-- story and digest are projections over it. These two tables only hold the read cursor and the
-- user-set notification policy.
--
-- Both key on (principal, project_id). project_id is the tenant boundary (every row carries it,
-- FK to project). Pre-auth, `principal` is a well-known default (mirroring DEFAULT_PROJECT_ID via
-- the `principal` seam); the same rows become per-user when auth lands, with no schema change.

-- Per-principal read cursor: the highest event seq the human has acknowledged seeing. The digest
-- is computed for events with seq > last_seen_seq. Defaults to 0 (never visited → first digest
-- covers everything). seq is bigint to match event.seq.
CREATE TABLE principal_cursor (
  principal     text   NOT NULL,
  project_id    text   NOT NULL REFERENCES project (id),
  last_seen_seq bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (principal, project_id)
);

-- User-set notification policy: the thresholds that drive tiered escalation (a single push only
-- when blast radius crosses the threshold or an ask ages past the SLA) and the batch-digest
-- cadence. One row per (principal, project_id); absence means "use the application default".
CREATE TABLE notification_policy (
  principal              text    NOT NULL,
  project_id             text    NOT NULL REFERENCES project (id),
  blast_radius_threshold integer NOT NULL,
  age_sla_seconds        integer NOT NULL,
  digest_cadence_seconds integer NOT NULL,
  PRIMARY KEY (principal, project_id)
);
