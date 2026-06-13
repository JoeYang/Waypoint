import { z } from "zod";

export const ASK_TYPES = ["QUESTION", "PROPOSAL", "DECISION"] as const;
export const AskType = z.enum(ASK_TYPES);
export type AskType = z.infer<typeof AskType>;

// Two flows share one state field:
//   OPEN → ANSWERED                     (human answers directly)
//   OPEN → ASSUMED → CONFIRMED|OVERTURNED  (agent proceeds; human ratifies/overturns)
export const ASK_STATES = ["OPEN", "ANSWERED", "ASSUMED", "CONFIRMED", "OVERTURNED"] as const;
export const AskState = z.enum(ASK_STATES);
export type AskState = z.infer<typeof AskState>;

export const AskOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
export type AskOption = z.infer<typeof AskOptionSchema>;

export const AskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  nodeId: z.string().min(1),
  type: AskType,
  state: AskState,
  required: z.boolean(), // only required+OPEN asks contribute to a node's `blocked`
  prompt: z.string().min(1),
  options: z.array(AskOptionSchema), // empty unless DECISION; ≥2 enforced at the boundary
  chosenOptionId: z.string().min(1).nullable(), // set when a DECISION is ANSWERED/CONFIRMED
  assumption: z.string().min(1).nullable(), // the agent's assumed answer while ASSUMED
  answerText: z.string().min(1).nullable(), // free-text answer for QUESTION/PROPOSAL
  version: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(), // epoch ms; also the inbox wait-time tiebreak
  updatedAt: z.number().int().nonnegative(),
});
export type Ask = z.infer<typeof AskSchema>;
