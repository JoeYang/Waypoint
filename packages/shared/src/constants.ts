import type { NotificationPolicy } from "./notifications.js";

// This slice operates on a single seeded project (no creation/switching UI). The id is
// well-known so the seed, the REST/web client, and the MCP bootstrap all agree on it.
export const DEFAULT_PROJECT_ID = "default";
export const DEFAULT_PROJECT_NAME = "Waypoint";

// Pre-auth, the re-entry cursor and notification policy key on a single well-known principal
// (mirroring DEFAULT_PROJECT_ID). The `principal` seam is the future per-user boundary; when
// auth lands the real principal replaces this with no schema change.
export const DEFAULT_PRINCIPAL = "__default__";

// Application-default notification policy used when a principal has set none: escalate a push at
// a blast radius of 3, or once an ask has waited 4h, and batch a digest daily otherwise.
export const DEFAULT_NOTIFICATION_POLICY: NotificationPolicy = {
  blastRadiusThreshold: 3,
  ageSlaSeconds: 4 * 60 * 60,
  digestCadenceSeconds: 24 * 60 * 60,
};
