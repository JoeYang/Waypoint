import { z } from "zod";

export const ASK_TYPES = ["QUESTION", "PROPOSAL", "DECISION"] as const;
export const AskType = z.enum(ASK_TYPES);
export type AskType = z.infer<typeof AskType>;

// The agent's own judgement of how risky a decision is and whether it can be undone, supplied at
// park time so the human surface shows real signal rather than a UI heuristic. Both default at the
// boundary when omitted (medium / reversible), so older callers stay valid.
export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const Risk = z.enum(RISK_LEVELS);
export type Risk = z.infer<typeof Risk>;

// Two flows share one state field:
//   OPEN → ANSWERED                     (human answers directly)
//   OPEN → ASSUMED → CONFIRMED|OVERTURNED  (agent proceeds; human ratifies/overturns)
export const ASK_STATES = ["OPEN", "ANSWERED", "ASSUMED", "CONFIRMED", "OVERTURNED"] as const;
export const AskState = z.enum(ASK_STATES);
export type AskState = z.infer<typeof AskState>;

export const AskOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  // What choosing this option commits to — shown beside the option so the choice is
  // self-evident. Capped to stay a glanceable line, not an essay.
  consequence: z.string().max(280).optional(),
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
  rationale: z.string().max(2000).nullable(), // why the agent needs this decided now
  options: z.array(AskOptionSchema), // empty unless DECISION; ≥2 enforced at the boundary
  suggestedAnswers: z.array(z.string().min(1)), // QUESTION: pick-first answers; [] otherwise
  agentLabel: z.string().min(1).nullable(), // stable human-friendly provenance for the story
  chosenOptionId: z.string().min(1).nullable(), // set when a DECISION is ANSWERED/CONFIRMED
  assumption: z.string().min(1).nullable(), // the agent's assumed answer while ASSUMED
  answerText: z.string().min(1).nullable(), // free-text answer for QUESTION/PROPOSAL
  version: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(), // epoch ms; also the inbox wait-time tiebreak
  updatedAt: z.number().int().nonnegative(),
});
export type Ask = z.infer<typeof AskSchema>;
