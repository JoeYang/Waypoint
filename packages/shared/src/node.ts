import { z } from "zod";

// Display hint only; intermediate levels may be skipped (a goal may directly parent a task).
export const NODE_KINDS = ["goal", "plan", "step", "task"] as const;
export const NodeKind = z.enum(NODE_KINDS);
export type NodeKind = z.infer<typeof NodeKind>;

// Stored status spine. `blocked` is computed, never stored (see ask-lifecycle spec).
export const NODE_STATUSES = ["DRAFT", "ACTIVE", "DONE", "DISCARDED"] as const;
export const NodeStatus = z.enum(NODE_STATUSES);
export type NodeStatus = z.infer<typeof NodeStatus>;

export const NodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable(), // null at the root; tree within one project
  kind: NodeKind,
  title: z.string().min(1),
  status: NodeStatus,
  discardReason: z.string().min(1).nullable(), // required iff status === DISCARDED
  sessionId: z.string().min(1).nullable(), // provenance: last session to mutate this node
  version: z.number().int().positive(), // optimistic-concurrency token, starts at 1
  createdAt: z.number().int().nonnegative(), // epoch ms
  updatedAt: z.number().int().nonnegative(),
});
export type Node = z.infer<typeof NodeSchema>;

// A directed dependency: `nodeId` is blocked while `dependsOnId` is not DONE.
// Edges are acyclic and confined to one project. Stored separately from nodes.
export const DependencyEdgeSchema = z.object({
  projectId: z.string().min(1),
  nodeId: z.string().min(1),
  dependsOnId: z.string().min(1),
});
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
