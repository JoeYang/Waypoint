import { z } from "zod";
import { InboxItemSchema } from "./inbox.js";

// The three-level progress read model (V2 slice 2). Every state below is *derived* from
// stored data (node status, ask state, depends_on edges) — never a stored column. The
// derivation rules live in the project-progress spec; this module is only the wire shape.

// A task's derived state. `failed` = a DISCARDED node (its discardReason is the why);
// `blocked-on-ask` = it has a required OPEN ask.
export const TaskState = z.enum(["running", "blocked-on-ask", "done", "failed"]);
export type TaskState = z.infer<typeof TaskState>;

// A plan is `blocked` if any descendant task is blocked-on-ask, `done` when all are
// done/closed, else `active`.
export const PlanState = z.enum(["active", "blocked", "done"]);
export type PlanState = z.infer<typeof PlanState>;

// A goal is `blocked` if no descendant work is movable, `at-risk` if some is blocked while
// other work can still proceed, else `on-track`.
export const GoalState = z.enum(["on-track", "at-risk", "blocked"]);
export type GoalState = z.infer<typeof GoalState>;

// The `step` a task sits under, if any — a kind-aware nested group between plan and task,
// surfaced for grouping without making the DTO a fully recursive tree.
export const TaskGroupSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
});
export type TaskGroup = z.infer<typeof TaskGroupSchema>;

export const TaskProgressSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
  state: TaskState,
  agentLabel: z.string().min(1).nullable(), // who is on it now; null if unattributed
  blastRadius: z.number().int().nonnegative(), // direct dependents — visual weight, not a sort key
  group: TaskGroupSchema.nullable(), // the owning step, or null when the plan parents it directly
  asks: z.array(InboxItemSchema), // open asks in InboxItem shape → the slice-1 card hydrates from one call
});
export type TaskProgress = z.infer<typeof TaskProgressSchema>;

export const PlanProgressSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
  state: PlanState,
  agentLabel: z.string().min(1).nullable(),
  lastActivityAt: z.number().int().nonnegative().nullable(), // epoch ms of the last event touching it
  openAskCount: z.number().int().nonnegative(), // rolled up from its tasks
  blastRadius: z.number().int().nonnegative(),
  tasks: z.array(TaskProgressSchema),
});
export type PlanProgress = z.infer<typeof PlanProgressSchema>;

export const GoalProgressSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1),
  state: GoalState,
  plansDone: z.number().int().nonnegative(),
  plansTotal: z.number().int().nonnegative(),
  openAskCount: z.number().int().nonnegative(), // all open asks beneath the goal
  blastRadius: z.number().int().nonnegative(),
  plans: z.array(PlanProgressSchema),
});
export type GoalProgress = z.infer<typeof GoalProgressSchema>;

// GET /v1/projects/:projectId/progress — the spine payload. `seq` is the project's latest
// event seq at read time (so the client can reconcile with the live inbox WS signal).
export const ProjectProgressSchema = z.object({
  projectId: z.string().min(1),
  seq: z.number().int().nonnegative(),
  goals: z.array(GoalProgressSchema),
});
export type ProjectProgress = z.infer<typeof ProjectProgressSchema>;
