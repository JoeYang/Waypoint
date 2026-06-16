import { z } from "zod";

// Who caused the mutation. Recorded on every event for decision archaeology.
export const ACTORS = ["human", "agent"] as const;
export const Actor = z.enum(ACTORS);
export type Actor = z.infer<typeof Actor>;

// One verb per logical mutation. WS deltas are derived projections of these events;
// derived recomputes (blocked/blast_radius) do NOT emit their own events.
export const EVENT_VERBS = [
  "node.created",
  "node.transitioned",
  "dependency.added",
  "ask.parked",
  "ask.assumed",
  "ask.answered",
  "ask.confirmed",
  "ask.overturned",
] as const;
export const EventVerb = z.enum(EVENT_VERBS);
export type EventVerb = z.infer<typeof EventVerb>;

export const EventRefSchema = z.object({
  kind: z.enum(["node", "ask"]),
  id: z.string().min(1),
});
export type EventRef = z.infer<typeof EventRefSchema>;

// Append-only audit row. Never updated or deleted. `summary` is human-readable and
// MUST NOT carry sensitive payloads (see security.md — log the seq, not the content).
export const EventSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  seq: z.number().int().positive(), // per-project monotonic, starts at 1
  actor: Actor,
  verb: EventVerb,
  ref: EventRefSchema,
  sessionId: z.string().min(1).nullable(),
  summary: z.string().nullable(),
  at: z.number().int().nonnegative(), // epoch ms
});
export type Event = z.infer<typeof EventSchema>;
