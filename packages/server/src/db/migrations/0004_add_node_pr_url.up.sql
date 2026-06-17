-- task-pr-links: a task node may carry the GitHub pull request URL for the work behind it,
-- supplied by the agent at create_node and surfaced in the progress tree. Nullable with no
-- default — absence is null, so existing rows read back as "no PR". Opaque to Waypoint
-- (no GitHub API); validated as a URL at the boundary, not in the DB.

ALTER TABLE node ADD COLUMN pr_url text;
