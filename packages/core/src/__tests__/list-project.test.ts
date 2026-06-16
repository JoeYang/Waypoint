import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";

const PROJECT = "proj-1";

// V2 slice 2 (project-progress-spine), task 2 — the goal→plan→task progress read model
// over in-memory fakes. States are derived (status is only DRAFT/ACTIVE/DONE/DISCARDED).

describe("listProject — three-level progress read model", () => {
  let backend: InMemoryBackend;
  let clock: FakeClock;
  let core: Core;

  const node = (
    kind: "goal" | "plan" | "step" | "task",
    title: string,
    parentId: string | null,
    sessionId?: string,
  ) =>
    core.createNode({
      projectId: PROJECT,
      parentId,
      kind,
      title,
      ...(sessionId ? { sessionId } : {}),
    });

  const parkRequired = (nodeId: string) =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "which?",
      required: true,
      rationale: "needs deciding",
      options: ["a", "b"],
      agentLabel: "builder",
    });

  beforeEach(() => {
    backend = new InMemoryBackend();
    clock = new FakeClock(1_000);
    core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("n") });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("rejects an unknown project", async () => {
    await expect(core.listProject("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns an empty, seq-0 tree for a project with no nodes", async () => {
    const res = await core.listProject(PROJECT);
    expect(res).toMatchObject({ projectId: PROJECT, seq: 0, goals: [] });
  });

  it("assembles a goal→plan→task tree with derived task states", async () => {
    const goal = await node("goal", "Ship checkout", null);
    const plan = await node("plan", "Refunds", goal.id);
    const running = await node("task", "running task", plan.id);
    const doneTask = await node("task", "done task", plan.id);
    await core.transition({
      projectId: PROJECT,
      nodeId: doneTask.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    await core.transition({
      projectId: PROJECT,
      nodeId: doneTask.id,
      to: "DONE",
      expectedVersion: 2,
    });
    const failed = await node("task", "failed task", plan.id);
    await core.transition({
      projectId: PROJECT,
      nodeId: failed.id,
      to: "DISCARDED",
      reason: "abandoned",
      expectedVersion: 1,
    });
    const blocked = await node("task", "blocked task", plan.id);
    await parkRequired(blocked.id);

    const res = await core.listProject(PROJECT);
    expect(res.goals).toHaveLength(1);
    const g = res.goals[0]!;
    expect(g.title).toBe("Ship checkout");
    expect(g.plans).toHaveLength(1);
    const p = g.plans[0]!;
    const stateOf = (id: string) => p.tasks.find((t) => t.nodeId === id)?.state;
    expect(stateOf(running.id)).toBe("running");
    expect(stateOf(doneTask.id)).toBe("done");
    expect(stateOf(failed.id)).toBe("failed");
    expect(stateOf(blocked.id)).toBe("blocked-on-ask");
  });

  it("derives plan state: blocked if any task is blocked-on-ask, done if all closed, else active", async () => {
    const goal = await node("goal", "G", null);
    // plan A — blocked
    const planA = await node("plan", "A", goal.id);
    const ta = await node("task", "ta", planA.id);
    await parkRequired(ta.id);
    // plan B — all done
    const planB = await node("plan", "B", goal.id);
    const tb = await node("task", "tb", planB.id);
    await core.transition({ projectId: PROJECT, nodeId: tb.id, to: "ACTIVE", expectedVersion: 1 });
    await core.transition({ projectId: PROJECT, nodeId: tb.id, to: "DONE", expectedVersion: 2 });
    // plan C — active (a running task)
    const planC = await node("plan", "C", goal.id);
    await node("task", "tc", planC.id);

    const res = await core.listProject(PROJECT);
    const byTitle = Object.fromEntries(res.goals[0]!.plans.map((p) => [p.title, p.state]));
    expect(byTitle).toEqual({ A: "blocked", B: "done", C: "active" });
  });

  it("derives goal state: on-track / at-risk / blocked", async () => {
    // on-track: nothing blocked
    const g1 = await node("goal", "on-track goal", null);
    const p1 = await node("plan", "p", g1.id);
    await node("task", "t", p1.id); // running

    // at-risk: one blocked, one still running
    const g2 = await node("goal", "at-risk goal", null);
    const p2 = await node("plan", "p", g2.id);
    const blockedT = await node("task", "blocked", p2.id);
    await parkRequired(blockedT.id);
    await node("task", "running", p2.id);

    // blocked: blocked and nothing movable
    const g3 = await node("goal", "blocked goal", null);
    const p3 = await node("plan", "p", g3.id);
    const onlyBlocked = await node("task", "only blocked", p3.id);
    await parkRequired(onlyBlocked.id);

    const res = await core.listProject(PROJECT);
    const byTitle = Object.fromEntries(res.goals.map((g) => [g.title, g.state]));
    expect(byTitle["on-track goal"]).toBe("on-track");
    expect(byTitle["at-risk goal"]).toBe("at-risk");
    expect(byTitle["blocked goal"]).toBe("blocked");
  });

  it("rolls up plansDone/plansTotal and the open-ask count", async () => {
    const goal = await node("goal", "G", null);
    const donePlan = await node("plan", "done", goal.id);
    const dt = await node("task", "dt", donePlan.id);
    await core.transition({ projectId: PROJECT, nodeId: dt.id, to: "ACTIVE", expectedVersion: 1 });
    await core.transition({ projectId: PROJECT, nodeId: dt.id, to: "DONE", expectedVersion: 2 });
    const openPlan = await node("plan", "open", goal.id);
    const ot = await node("task", "ot", openPlan.id);
    await parkRequired(ot.id);

    const g = (await core.listProject(PROJECT)).goals[0]!;
    expect(g.plansTotal).toBe(2);
    expect(g.plansDone).toBe(1);
    expect(g.openAskCount).toBe(1);
  });

  it("carries each task's open asks in InboxItem shape (enriched), and reports blast radius as weight", async () => {
    const goal = await node("goal", "G", null);
    const plan = await node("plan", "P", goal.id);
    const task = await node("task", "cache", plan.id);
    const dependent = await node("task", "refunds", plan.id);
    await core.addDependency({ projectId: PROJECT, nodeId: dependent.id, dependsOnId: task.id });
    const ask = await parkRequired(task.id);

    const g = (await core.listProject(PROJECT)).goals[0]!;
    const t = g.plans[0]!.tasks.find((x) => x.nodeId === task.id)!;
    expect(t.blastRadius).toBe(1);
    expect(t.asks).toHaveLength(1);
    expect(t.asks[0]).toMatchObject({
      askId: ask.id,
      rationale: "needs deciding",
      goalTitle: "G",
      blocks: [{ nodeId: dependent.id, title: "refunds" }],
      parkedBy: { agentLabel: "builder" },
    });
  });

  it("nests a task under its step as a group", async () => {
    const goal = await node("goal", "G", null);
    const plan = await node("plan", "P", goal.id);
    const step = await node("step", "migration", plan.id);
    const task = await node("task", "alter table", step.id);

    const g = (await core.listProject(PROJECT)).goals[0]!;
    const t = g.plans[0]!.tasks.find((x) => x.nodeId === task.id)!;
    expect(t.group).toEqual({ nodeId: step.id, title: "migration" });
  });

  it("attributes the current agent from the node's session as a stable alias", async () => {
    const goal = await node("goal", "G", null);
    const plan = await node("plan", "P", goal.id, "sess-xyz");
    await node("task", "t", plan.id);

    const p = (await core.listProject(PROJECT)).goals[0]!.plans[0]!;
    expect(p.agentLabel).not.toBeNull();
    expect(p.agentLabel).not.toBe("sess-xyz"); // never the raw id
  });

  it("terminates on a corrupt parent cycle (failure injection)", async () => {
    const goal = await node("goal", "G", null);
    const plan = await node("plan", "P", goal.id);
    const task = await node("task", "t", plan.id);
    // Corrupt: point the plan's parent at its own task → cycle.
    backend.state.nodes.get(plan.id)!.parentId = task.id;

    const res = await core.listProject(PROJECT); // must not hang
    expect(res.projectId).toBe(PROJECT);
  });
});
