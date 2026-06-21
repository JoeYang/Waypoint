-- Reverse 0005_add_reentry_state. Drops the re-entry read cursor and the notification policy.
-- The append-only event log is unaffected (it was never touched by the up migration), so the
-- digest/story remain computable from the log after a down — only the saved cursor + policy go.

DROP TABLE notification_policy;
DROP TABLE principal_cursor;
