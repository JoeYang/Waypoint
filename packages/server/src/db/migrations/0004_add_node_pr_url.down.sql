-- Reverse 0004_add_node_pr_url. Drops the agent-supplied GitHub PR URL column.

ALTER TABLE node DROP COLUMN pr_url;
