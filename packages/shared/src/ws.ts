import { z } from "zod";
import { InboxItemSchema } from "./inbox.js";

// WebSocket contract for the live inbox. Deltas are derived projections of the one
// underlying event; each carries the project `seq` so clients dedupe idempotently and
// resume from their last applied seq.

// Client → server: open or resume a subscription. lastSeq null means "send a fresh snapshot".
export const WsResumeSchema = z.object({
  type: z.literal("resume"),
  projectId: z.string().min(1),
  lastSeq: z.number().int().nonnegative().nullable(),
});
export type WsResume = z.infer<typeof WsResumeSchema>;

export const WsClientFrameSchema = z.discriminatedUnion("type", [WsResumeSchema]);
export type WsClientFrame = z.infer<typeof WsClientFrameSchema>;

// Server → client: a projection of the inbox at a given project `seq`. Carries the cards
// that changed (upserts) and those that left the queue (removedAskIds). Also used for the
// initial snapshot on connect — for a project with no events yet that snapshot is empty at
// `seq: 0`, so seq is non-negative (0 = before any event), not strictly positive.
export const WsDeltaSchema = z.object({
  type: z.literal("delta"),
  seq: z.number().int().nonnegative(),
  upserts: z.array(InboxItemSchema),
  removedAskIds: z.array(z.string().min(1)),
});
export type WsDelta = z.infer<typeof WsDeltaSchema>;

// Server → client: the client's lastSeq predates retained history — resync the full inbox.
export const WsResyncSchema = z.object({
  type: z.literal("resync"),
  reason: z.string().min(1),
});
export type WsResync = z.infer<typeof WsResyncSchema>;

// Server → client: a tiered notification escalated (V2 slice 3) — the reference transport for the
// notifier. Emitted at most once per escalating ask, never one-per-ask in bulk. Carries the
// `seq` + a non-sensitive `summary` only (security.md: never tokens/PII/decision payloads). The
// client refetches the digest in response; reason mirrors the escalation decision.
export const WsDigestReadySchema = z.object({
  type: z.literal("digest.ready"),
  seq: z.number().int().nonnegative(),
  reason: z.enum(["threshold", "sla"]), // why it escalated (a batched ask never pushes)
  askId: z.string().min(1), // the ask that triggered the escalation
  summary: z.string().min(1), // non-sensitive, human-legible
});
export type WsDigestReady = z.infer<typeof WsDigestReadySchema>;

export const WsServerFrameSchema = z.discriminatedUnion("type", [
  WsDeltaSchema,
  WsResyncSchema,
  WsDigestReadySchema,
]);
export type WsServerFrame = z.infer<typeof WsServerFrameSchema>;
