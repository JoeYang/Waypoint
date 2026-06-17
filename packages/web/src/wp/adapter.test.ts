import { describe, it, expect } from "vitest";
import type { InboxItem, ProjectProgress, ProjectSummary, TaskProgress } from "@waypoint/shared";
import type { Event } from "@waypoint/shared";
import {
  toTask,
  toStream,
  progressToStreams,
  toDecision,
  toProject,
  eventsToActivity,
  deriveNotifications,
} from "./adapter.js";

const NOW = 1_700_000_000_000;

const task = (over: Partial<TaskProgress>): TaskProgress => ({
  nodeId: "t1",
  title: "A task",
  state: "running",
  agentLabel: null,
  blastRadius: 0,
  group: null,
  asks: [],
  ...over,
});

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  askId: "d1",
  nodeId: "t1",
  nodeTitle: "Choose ORM",
  type: "DECISION",
  state: "OPEN",
  prompt: "Which ORM?",
  required: true,
  options: [
    { id: "opt-1", label: "Prisma", consequence: "heavy runtime" },
    { id: "opt-2", label: "Drizzle" },
  ],
  blastRadius: 2,
  parkedAt: NOW - 12 * 60_000,
  askVersion: 1,
  nodeVersion: 1,
  risk: "high",
  reversible: false,
  rationale: "shapes every query",
  blocks: [{ nodeId: "t2", title: "Seed scripts" }],
  ...over,
});

const progress = (): ProjectProgress => ({
  projectId: "p1",
  seq: 5,
  goals: [
    {
      nodeId: "g1",
      title: "Ship API",
      state: "at-risk",
      plansDone: 0,
      plansTotal: 1,
      openAskCount: 1,
      blastRadius: 0,
      plans: [
        {
          nodeId: "plan-data",
          title: "Data layer",
          state: "blocked",
          agentLabel: "data-agent",
          lastActivityAt: NOW,
          openAskCount: 1,
          blastRadius: 0,
          tasks: [
            task({ nodeId: "t0", title: "Schema", state: "done" }),
            task({ nodeId: "t1", title: "Choose ORM", state: "blocked-on-ask", asks: [item()] }),
          ],
        },
      ],
    },
  ],
});

const summary: ProjectSummary = { id: "p1", name: "orbit-api", openAskCount: 1, agentTaskCount: 3 };

describe("adapter — task & stream status", () => {
  it("maps task states (running→active with a note, blocked-on-ask→blocked+decision, failed→blocked)", () => {
    expect(toTask(task({ state: "running", agentLabel: "a" }))).toMatchObject({
      status: "active",
      note: "a is here",
    });
    const blocked = toTask(task({ state: "blocked-on-ask", asks: [item({ askId: "dX" })] }));
    expect(blocked).toMatchObject({ status: "blocked", decision: "dX" });
    expect(toTask(task({ state: "failed" })).status).toBe("blocked");
    expect(toTask(task({ state: "done" })).status).toBe("done");
  });

  it("maps a plan to a stream and flattens goals→plans", () => {
    const streams = progressToStreams(progress());
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({ name: "Data layer", status: "blocked" });
    expect(streams[0]?.tasks.map((t) => t.status)).toEqual(["done", "blocked"]);
    expect(toStream(progress().goals[0]!.plans[0]!).id).toBe("plan-data");
  });
});

describe("adapter — decision (D8 provenance)", () => {
  it("carries agent-supplied risk/reversible and derives the rest", () => {
    const d = toDecision(item(), "Data layer", NOW);
    expect(d).toMatchObject({
      id: "d1",
      risk: "high",
      reversible: false,
      blocking: true,
      stream: "Data layer",
      blocksTask: "Choose ORM",
      title: "Which ORM?",
      context: "shapes every query",
      parked: "12m ago",
    });
    expect(d.impact.kind).toBe("danger"); // high risk
    expect(d.version).toBe(1); // ask version carried for optimistic concurrency
    expect(d.options[0]).toEqual({
      id: "opt-1",
      name: "Prisma",
      pros: ["heavy runtime"],
      cons: [],
    });
  });

  it("degrades the no-source fields (no rec, no file)", () => {
    const d = toDecision(item({ risk: "low" }), "S", NOW);
    expect(d.recReason).toBe("");
    expect(d.options.some((o) => o.rec)).toBe(false);
    expect(d.file).toBe("");
    expect(d.impact.kind).toBe("info"); // non-high risk
  });
});

describe("adapter — project assembly", () => {
  it("assembles a project with streams, decisions keyed to their plan, and derived chrome", () => {
    const p = toProject(summary, progress(), [item()], [], NOW);
    expect(p).toMatchObject({ id: "p1", name: "orbit-api", agent: "working", agentTasks: 3 });
    expect(p.streams).toHaveLength(1);
    expect(p.decisions[0]).toMatchObject({ id: "d1", stream: "Data layer" });
    expect(p.glyph).toBe("OR"); // deterministic from the name
    expect(p.color).toMatch(/^#/);
    expect(p.activity).toEqual([]); // events folded in at PR7
  });

  it("reads idle when no agent tasks, and honours a chrome override", () => {
    const idle = toProject({ ...summary, agentTaskCount: 0 }, progress(), [], [], NOW, {
      p1: { glyph: "ZZ", color: "#000", desc: "custom" },
    });
    expect(idle.agent).toBe("idle");
    expect(idle).toMatchObject({ glyph: "ZZ", color: "#000", desc: "custom" });
  });
});

const event = (over: Partial<Event>): Event => ({
  id: "e1",
  projectId: "p1",
  seq: 1,
  actor: "agent",
  verb: "node.created",
  ref: { kind: "node", id: "n1" },
  sessionId: null,
  summary: "did a thing",
  at: NOW,
  ...over,
});

describe("adapter — activity & notifications", () => {
  it("maps event verbs to dot kinds, newest first, grouped by time", () => {
    const groups = eventsToActivity([
      event({ seq: 1, verb: "node.created", summary: "created", at: NOW - 3_600_000 }),
      event({ seq: 2, verb: "ask.parked", summary: "parked it", at: NOW }),
      event({ seq: 3, verb: "ask.answered", summary: "you answered", at: NOW }),
    ]);
    // Newest (seq 3, 2 share NOW) first; the older one (seq 1) is a separate time group.
    expect(groups[0]?.items.map((i) => i.kind)).toEqual(["you", "parked"]);
    expect(groups[1]?.items[0]).toMatchObject({ kind: "edit", text: "created" });
  });

  it("derives a notification per open decision across projects", () => {
    const p = toProject(summary, progress(), [item({ askId: "d1" })], [], NOW);
    const notes = deriveNotifications([p]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      project: "orbit-api",
      tone: "warning", // d1 is high risk
      to: { project: "p1", decision: "d1", view: "proposal" },
    });
  });
});
