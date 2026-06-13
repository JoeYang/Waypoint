import { z } from "zod";
import { AskType, AskState, AskOptionSchema } from "./ask.js";

// One ranked inbox card. `blastRadius` is the count of nodes directly gated by this
// ask — rendered as "blocks N". Versions are echoed for optimistic-concurrency answers.
export const InboxItemSchema = z.object({
  askId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeTitle: z.string().min(1),
  type: AskType,
  state: AskState,
  prompt: z.string().min(1),
  required: z.boolean(),
  options: z.array(AskOptionSchema),
  blastRadius: z.number().int().nonnegative(),
  parkedAt: z.number().int().nonnegative(), // ask.createdAt; wait-time tiebreak
  askVersion: z.number().int().positive(),
  nodeVersion: z.number().int().positive(),
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

// GET /v1/projects/:projectId/inbox — ranked blast_radius desc, ties oldest-first.
export const InboxResponseSchema = z.object({
  projectId: z.string().min(1),
  seq: z.number().int().nonnegative(), // the project's latest event seq at read time
  items: z.array(InboxItemSchema),
});
export type InboxResponse = z.infer<typeof InboxResponseSchema>;

// POST /v1/projects/:projectId/asks/:askId/answer — exactly one of chosenOptionId
// (DECISION) / answerText (QUESTION|PROPOSAL) is validated against the ask's type.
export const AnswerRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  chosenOptionId: z.string().min(1).optional(),
  answerText: z.string().min(1).optional(),
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

export const AnswerResponseSchema = z.object({
  askId: z.string().min(1),
  askState: AskState,
  askVersion: z.number().int().positive(),
  nodeId: z.string().min(1),
  nodeBlocked: z.boolean(),
  nodeVersion: z.number().int().positive(),
});
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;
