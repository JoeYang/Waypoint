import { z } from "zod";
import { Actor, EventVerb } from "./event.js";
import { NodeKind } from "./node.js";
import { AskType, Risk } from "./ask.js";

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

// An ask still waiting on the human at read time — the "what's waiting" row. Carries the
// agent-declared risk/reversibility (so the surface shows danger at a glance) and `isNew`: true
// exactly when the ask was parked within the unseen window (its parking seq > the caller's
// last-seen seq) — the "NEW vs Seen" / "new since you left" signal, derived from the cursor.
export const DigestAskSchema = z.object({
  askId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeTitle: z.string().min(1),
  type: AskType,
  prompt: z.string().min(1),
  blastRadius: z.number().int().nonnegative(),
  ageMs: z.number().int().nonnegative(), // how long it has waited (read time − parkedAt)
  risk: Risk, // agent-declared risk, surfaced from the ask
  reversible: z.boolean(), // agent-declared reversibility, surfaced from the ask
  isNew: z.boolean(), // parked since the caller's last-seen seq
});
export type DigestAsk = z.infer<typeof DigestAskSchema>;

// Where an agent is working right now — the "Now — working on «task»" line. Derived from the
// current node snapshot (a task that is ACTIVE and not blocked-on-ask). It names the task and its
// parent stream, never a file path: the system holds no agent file-position signal.
export const DigestActiveWorkSchema = z.object({
  nodeId: z.string().min(1),
  nodeTitle: z.string().min(1),
  kind: NodeKind,
  streamId: z.string().min(1).nullable(), // the parent node (the "stream"); null at the root
  streamTitle: z.string().min(1).nullable(), // the parent node's title, for "Data layer — Seed scripts"
});
export type DigestActiveWork = z.infer<typeof DigestActiveWorkSchema>;

// A heads-up item — an open ask that needs a careful eye. `kind` ranks the styling: "danger" when
// the ask is irreversible (one-way), "warning" when it is reversible but high-risk.
export const DIGEST_HEADSUP_KINDS = ["danger", "warning"] as const;
export const DigestHeadsUpKind = z.enum(DIGEST_HEADSUP_KINDS);
export type DigestHeadsUpKind = z.infer<typeof DigestHeadsUpKind>;
export const DigestHeadsUpSchema = z.object({
  askId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeTitle: z.string().min(1),
  prompt: z.string().min(1),
  risk: Risk,
  reversible: z.boolean(),
  kind: DigestHeadsUpKind,
});
export type DigestHeadsUp = z.infer<typeof DigestHeadsUpSchema>;

// Snapshot tallies of task-kind nodes by derived state, for a segmented progress meter
// (done / active / parked / queued). Discarded nodes are excluded.
export const DigestTalliesSchema = z.object({
  done: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  parked: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
});
export type DigestTallies = z.infer<typeof DigestTalliesSchema>;

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
  activeWork: z.array(DigestActiveWorkSchema), // where agents are working now (current snapshot)
  headsUp: z.array(DigestHeadsUpSchema), // open asks needing a careful eye (irreversible/high-risk)
  tallies: DigestTalliesSchema, // task-state counts for the progress meter
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
