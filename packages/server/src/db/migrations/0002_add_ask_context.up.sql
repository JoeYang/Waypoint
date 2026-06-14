-- V2 slice 1 (decision-context-and-actions): enrich an ask with the context a human needs
-- to answer without re-deriving it, and a stable agent provenance label.
--   rationale         — why the agent needs this decided now (nullable; older asks have none)
--   suggested_answers — QUESTION pick-first answers; [] for other types (mirrors the domain
--                       default, so NOT NULL with an empty-array default beats nullable)
--   agent_label       — human-friendly provenance ("checkout-agent"); never the raw session id
-- Per-option consequence rides in the existing `options` jsonb, so it needs no DDL.

ALTER TABLE ask ADD COLUMN rationale text;
ALTER TABLE ask ADD COLUMN suggested_answers jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ask ADD COLUMN agent_label text;
