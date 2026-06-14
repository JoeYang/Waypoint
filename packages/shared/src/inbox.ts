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
  options: z.array(AskOptionSchema), // each option may carry a `consequence`
  blastRadius: z.number().int().nonnegative(),
  parkedAt: z.number().int().nonnegative(), // ask.createdAt; wait-time tiebreak
  askVersion: z.number().int().positive(),
  nodeVersion: z.number().int().positive(),
  // Decision context (slice 1). Optional so older asks / absent context degrade gracefully.
  rationale: z.string().nullable().optional(), // why this is being asked
  blocks: z.array(z.object({ nodeId: z.string().min(1), title: z.string().min(1) })).optional(),
  goalTitle: z.string().min(1).nullable().optional(), // the goal this work ladders toward
  suggestedAnswers: z.array(z.string().min(1)).optional(), // QUESTION pick-first answers
  parkedBy: z
    .object({ agentLabel: z.string().min(1), at: z.number().int().nonnegative() })
    .optional(), // provenance: a stable label, never a raw session id
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

// GET /v1/projects/:projectId/inbox — ranked blast_radius desc, ties oldest-first.
export const InboxResponseSchema = z.object({
  projectId: z.string().min(1),
  seq: z.number().int().nonnegative(), // the project's latest event seq at read time
  items: z.array(InboxItemSchema),
});
export type InboxResponse = z.infer<typeof InboxResponseSchema>;

// POST /v1/projects/:projectId/asks/:askId/answer — the answer is intent-typed and
// validated against the ask's type by core: a DECISION carries `chosenOptionId`; a PROPOSAL
// carries a `proposalVerdict` (with an `adjustmentNote` only when `adjust`); a QUESTION
// carries `answerText`. An `adjust` is an approval carrying its constraint, not a new ask.
export const ProposalVerdict = z.enum(["approve", "adjust", "reject"]);
export type ProposalVerdict = z.infer<typeof ProposalVerdict>;

export const AnswerRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  chosenOptionId: z.string().min(1).optional(),
  answerText: z.string().min(1).optional(),
  proposalVerdict: ProposalVerdict.optional(),
  adjustmentNote: z.string().min(1).max(2000).optional(), // only meaningful with `adjust`
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
