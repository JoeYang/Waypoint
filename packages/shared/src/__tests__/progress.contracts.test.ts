import { describe, it, expect } from "vitest";
import {
  GoalState,
  PlanState,
  TaskState,
  TaskProgressSchema,
  PlanProgressSchema,
  GoalProgressSchema,
  ProjectProgressSchema,
} from "../progress.js";

// Contracts for V2 slice 2 (project-progress-spine), task 1 — the read-model DTO shape only.
// The derivation behaviour (core.listProject computing these) is covered in the core suite.

const inboxAsk = {
  askId: "a1",
  nodeId: "t1",
  nodeTitle: "cache layer",
  type: "DECISION" as const,
  state: "OPEN" as const,
  prompt: "which cache?",
  required: true,
  options: [{ id: "opt-1", label: "redis" }],
  blastRadius: 1,
  parkedAt: 0,
  askVersion: 1,
  nodeVersion: 1,
  risk: "medium" as const,
  reversible: true,
};

const task = {
  nodeId: "t1",
  title: "cache layer",
  state: "blocked-on-ask" as const,
  agentLabel: "checkout-agent",
  blastRadius: 2,
  group: null,
  asks: [inboxAsk],
};

const plan = {
  nodeId: "p1",
  title: "Refunds",
  state: "blocked" as const,
  agentLabel: "checkout-agent",
  lastActivityAt: 1000,
  openAskCount: 1,
  blastRadius: 2,
  tasks: [task],
};

const goal = {
  nodeId: "g1",
  title: "Ship checkout",
  state: "at-risk" as const,
  plansDone: 1,
  plansTotal: 2,
  openAskCount: 1,
  blastRadius: 0,
  plans: [plan],
};

describe("progress state enums", () => {
  it("fixes the three derived state vocabularies", () => {
    expect(GoalState.options).toEqual(["on-track", "at-risk", "blocked"]);
    expect(PlanState.options).toEqual(["active", "blocked", "done"]);
    expect(TaskState.options).toEqual(["running", "blocked-on-ask", "done", "failed"]);
  });

  it("rejects an unknown task state", () => {
    expect(TaskState.safeParse("cancelled").success).toBe(false);
  });
});

describe("TaskProgress", () => {
  it("carries state, agent, blast radius, an optional step group, and asks in InboxItem shape", () => {
    const parsed = TaskProgressSchema.parse(task);
    expect(parsed.state).toBe("blocked-on-ask");
    expect(parsed.group).toBeNull();
    expect(parsed.asks[0]?.askId).toBe("a1");
  });

  it("accepts a step group when the task sits under one", () => {
    const parsed = TaskProgressSchema.parse({
      ...task,
      group: { nodeId: "s1", title: "migration" },
    });
    expect(parsed.group).toEqual({ nodeId: "s1", title: "migration" });
  });

  it("requires the embedded asks to be valid InboxItems", () => {
    const bad = { ...task, asks: [{ askId: "a1" }] };
    expect(TaskProgressSchema.safeParse(bad).success).toBe(false);
  });

  it("a running task carries no asks", () => {
    const parsed = TaskProgressSchema.parse({ ...task, state: "running", asks: [] });
    expect(parsed.asks).toEqual([]);
  });
});

describe("PlanProgress / GoalProgress", () => {
  it("a plan rolls up its tasks, agent, last activity, and open-ask count", () => {
    const parsed = PlanProgressSchema.parse(plan);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.lastActivityAt).toBe(1000);
    expect(parsed.openAskCount).toBe(1);
  });

  it("allows a plan with no recorded activity yet", () => {
    expect(PlanProgressSchema.parse({ ...plan, lastActivityAt: null }).lastActivityAt).toBeNull();
  });

  it("a goal reports plan progress and an open-ask count", () => {
    const parsed = GoalProgressSchema.parse(goal);
    expect(parsed.state).toBe("at-risk");
    expect(parsed.plansDone).toBe(1);
    expect(parsed.plansTotal).toBe(2);
  });

  it("rejects negative counts", () => {
    expect(GoalProgressSchema.safeParse({ ...goal, openAskCount: -1 }).success).toBe(false);
  });
});

describe("ProjectProgress (the spine payload)", () => {
  it("carries the project id, the read-time seq, and the goal tree", () => {
    const parsed = ProjectProgressSchema.parse({ projectId: "proj-1", seq: 7, goals: [goal] });
    expect(parsed.projectId).toBe("proj-1");
    expect(parsed.seq).toBe(7);
    expect(parsed.goals[0]?.plans[0]?.tasks[0]?.asks[0]?.askId).toBe("a1");
  });

  it("parses an empty project (no goals, seq 0)", () => {
    expect(ProjectProgressSchema.parse({ projectId: "p", seq: 0, goals: [] }).goals).toEqual([]);
  });
});
