import { z } from "zod";
import { Actor, EventVerb } from "./event.js";
import { NodeKind } from "./node.js";
import { AskType } from "./ask.js";

// Re-entry read models (V2 slice 3). Both the story and the digest are *projections* over the
// append-only event log — never a new source of truth, never a stored column. The event log is
// read verbatim; these shapes are only the wire DTOs. Derivation rules live in the re-entry spec.

// One node-threaded narrative entry: a single event read back as "who did what, to which node".
// `actorLabel` is the resolved, human-legible actor (a stable agent label, or null for the human /
// when unattributed) — never a raw session id (security.md: log the seq, not sensitive content).
export const StoryEntrySchema = z.object({
  seq: z.number().int().positive(), // the event's per-project seq — stable ordering + dedupe
  at: z.number().int().nonnegative(), // epoch ms
  actor: Actor,
  actorLabel: z.string().min(1).nullable(),
  verb: EventVerb,
  nodeId: z.string().min(1), // the node this entry threads under
  nodeTitle: z.string().min(1).nullable(), // null if the node is gone from the read model
  summary: z.string().nullable(), // human-readable, non-sensitive (mirrors event.summary)
});
export type StoryEntry = z.infer<typeof StoryEntrySchema>;

// GET /v1/projects/:projectId/story — the threaded narrative, oldest-first, bounded by a window.
// `seq` echoes the project's latest seq so the client can reconcile with the live WS signal.
export const StoryResponseSchema = z.object({
  projectId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  entries: z.array(StoryEntrySchema),
});
export type StoryResponse = z.infer<typeof StoryResponseSchema>;

// A node that reached a terminal/blocked state in the window — the "what shipped" / "what's
// newly blocked" rows of the digest.
export const DigestNodeSchema = z.object({
  nodeId: z.string().min(1),
  kind: NodeKind,
  title: z.string().min(1),
});
export type DigestNode = z.infer<typeof DigestNodeSchema>;

// An ask still waiting on the human at read time — the "what's waiting" row.
export const DigestAskSchema = z.object({
  askId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeTitle: z.string().min(1),
  type: AskType,
  prompt: z.string().min(1),
  blastRadius: z.number().int().nonnegative(),
  ageMs: z.number().int().nonnegative(), // how long it has waited (read time − parkedAt)
});
export type DigestAsk = z.infer<typeof DigestAskSchema>;

// GET /v1/projects/:projectId/digest — the while-you-were-away briefing since the caller's
// last-seen cursor, rolled up across goal/plan/task. `sinceSeq` is the cursor it was computed
// from (0 = never visited); `seq` is the latest at read time. The endpoint is read-only — the
// cursor advances only via an explicit ack (POST /digest/ack), so multiple reads are stable.
export const DigestSchema = z.object({
  projectId: z.string().min(1),
  sinceSeq: z.number().int().nonnegative(),
  seq: z.number().int().nonnegative(),
  shipped: z.array(DigestNodeSchema), // nodes that reached DONE in the window
  newlyBlocked: z.array(DigestNodeSchema), // nodes that became blocked-on-ask in the window
  waiting: z.array(DigestAskSchema), // asks still open and waiting on the human
});
export type Digest = z.infer<typeof DigestSchema>;

// POST /v1/projects/:projectId/digest/ack — advance the read cursor to `seq` (explicit ack,
// consistent with the WS resume cursor). Idempotent; advancing to an older seq is a no-op.
export const DigestAckRequestSchema = z.object({
  seq: z.number().int().nonnegative(),
});
export type DigestAckRequest = z.infer<typeof DigestAckRequestSchema>;

export const DigestAckResponseSchema = z.object({
  projectId: z.string().min(1),
  lastSeenSeq: z.number().int().nonnegative(),
});
export type DigestAckResponse = z.infer<typeof DigestAckResponseSchema>;
