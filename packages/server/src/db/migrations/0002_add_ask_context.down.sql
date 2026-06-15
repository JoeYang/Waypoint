-- Reverse 0002_add_ask_context. Drops the decision-context columns; per-option consequence
-- lived in the existing `options` jsonb, so nothing to revert there.

ALTER TABLE ask DROP COLUMN agent_label;
ALTER TABLE ask DROP COLUMN suggested_answers;
ALTER TABLE ask DROP COLUMN rationale;
