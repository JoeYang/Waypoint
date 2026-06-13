import { z } from "zod";
import { NodeKind, NodeStatus } from "./node.js";
import { AskType } from "./ask.js";

// Argument and result schemas for the MCP tools an agent uses to drive the loop.
// Every tool argument is validated against these at the boundary before domain logic
// runs (see agent-mcp-api spec + security.md). Mutations of existing rows carry
// `expectedVersion`; `sessionId` is recorded as provenance.

// get_context — entry tool advertised via InitializeResult.instructions.
export const GetContextInputSchema = z.object({
  projectId: z.string().min(1),
});
export type GetContextInput = z.infer<typeof GetContextInputSchema>;

// A compacted, summarized context pack. Never raw event rows.
export const ContextPackSchema = z.object({
  project: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  goal: z.string().min(1).nullable(),
  openAsks: z.array(
    z.object({
      id: z.string().min(1),
      nodeId: z.string().min(1),
      type: AskType,
      prompt: z.string().min(1),
      required: z.boolean(),
      blastRadius: z.number().int().nonnegative(),
    }),
  ),
  recentDecisions: z.array(
    z.object({
      askId: z.string().min(1),
      prompt: z.string().min(1),
      resolution: z.string().min(1),
      at: z.number().int().nonnegative(),
    }),
  ),
  provenance: z.object({ lastSessionId: z.string().min(1).nullable() }),
});
export type ContextPack = z.infer<typeof ContextPackSchema>;

export const CreateNodeInputSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  kind: NodeKind,
  title: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});
export type CreateNodeInput = z.infer<typeof CreateNodeInputSchema>;

export const CreateNodeResultSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export type CreateNodeResult = z.infer<typeof CreateNodeResultSchema>;

// Options are supplied as labels; core assigns stable option ids. A DECISION needs ≥2.
// The raw shape is exported separately so the MCP server can register it as a tool input
// (refined schemas expose no `.shape`); the ≥2 rule is enforced by the refine and by core.
export const parkAskInputShape = {
  projectId: z.string().min(1),
  nodeId: z.string().min(1),
  type: AskType,
  prompt: z.string().min(1),
  required: z.boolean(),
  options: z.array(z.string().min(1)).default([]),
  assumption: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
} as const;

export const ParkAskInputSchema = z.object(parkAskInputShape).refine(
  (v) => v.type !== "DECISION" || v.options.length >= 2,
  {
    message: "A DECISION ask must carry at least two options",
    path: ["options"],
  },
);
export type ParkAskInput = z.infer<typeof ParkAskInputSchema>;

export const ParkAskResultSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export type ParkAskResult = z.infer<typeof ParkAskResultSchema>;

// transition — move a node along the status spine; DISCARDED requires a reason.
export const TransitionInputSchema = z.object({
  projectId: z.string().min(1),
  nodeId: z.string().min(1),
  to: NodeStatus,
  reason: z.string().min(1).optional(),
  expectedVersion: z.number().int().positive(),
  sessionId: z.string().min(1).optional(),
});
export type TransitionInput = z.infer<typeof TransitionInputSchema>;

export const TransitionResultSchema = z.object({
  id: z.string().min(1),
  status: NodeStatus,
  version: z.number().int().positive(),
});
export type TransitionResult = z.infer<typeof TransitionResultSchema>;
