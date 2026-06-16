-- live-wiring group A: the agent declares how risky and how reversible a decision is at park
-- time, so the human surface shows real signal rather than a UI heuristic.
--   risk       — low | medium | high; NOT NULL DEFAULT 'medium' so older asks read sensibly
--   reversible — can the decision be undone; NOT NULL DEFAULT true (most decisions are)
-- Both are agent-supplied via park_ask and default at the boundary when omitted.

ALTER TABLE ask ADD COLUMN risk text NOT NULL DEFAULT 'medium';
ALTER TABLE ask ADD COLUMN reversible boolean NOT NULL DEFAULT true;
