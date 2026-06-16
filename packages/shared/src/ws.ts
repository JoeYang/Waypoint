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

export const WsServerFrameSchema = z.discriminatedUnion("type", [WsDeltaSchema, WsResyncSchema]);
export type WsServerFrame = z.infer<typeof WsServerFrameSchema>;
