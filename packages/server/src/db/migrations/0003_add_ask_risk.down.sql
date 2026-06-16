-- Reverse 0003_add_ask_risk. Drops the agent-supplied risk + reversibility columns.

ALTER TABLE ask DROP COLUMN reversible;
ALTER TABLE ask DROP COLUMN risk;
