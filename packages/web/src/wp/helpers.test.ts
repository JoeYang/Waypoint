import { describe, it, expect } from "vitest";
import {
  streamProgress,
  streamBarColor,
  taskIconName,
  projectTally,
  projectTasks,
  currentTask,
} from "./helpers.js";
import type { Project, Stream } from "./types.js";

const stream = (
  status: Stream["status"],
  statuses: Stream["tasks"][number]["status"][],
): Stream => ({
  id: "s",
  name: "S",
  status,
  tasks: statuses.map((s, i) => ({ name: `t${i}`, status: s })),
});

const project = (streams: Stream[]): Project => ({
  id: "p",
  name: "P",
  desc: "",
  glyph: "P",
  color: "#000",
  agent: "working",
  agentTasks: 0,
  streams,
  decisions: [],
  activity: [],
});

describe("streamProgress", () => {
  it("counts done over total and rounds the percent", () => {
    expect(streamProgress(stream("active", ["done", "done", "active", "queued"]))).toEqual({
      done: 2,
      total: 4,
      pct: 50,
    });
  });

  it("reports 100% when all tasks are done", () => {
    expect(streamProgress(stream("done", ["done", "done"]))).toEqual({
      done: 2,
      total: 2,
      pct: 100,
    });
  });

  it("guards an empty stream (no division by zero)", () => {
    expect(streamProgress(stream("queued", []))).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe("streamBarColor", () => {
  it("maps each stream status to its token color", () => {
    expect(streamBarColor(stream("done", ["done"]))).toBe("var(--green-600)");
    expect(streamBarColor(stream("blocked", ["blocked"]))).toBe("var(--amber-500)");
    expect(streamBarColor(stream("queued", ["queued"]))).toBe("var(--ink-300)");
    expect(streamBarColor(stream("active", ["active"]))).toBe("var(--accent-500)");
  });
});

describe("projectTasks", () => {
  it("flattens tasks across all streams", () => {
    const p = project([stream("active", ["done", "active"]), stream("queued", ["queued"])]);
    expect(projectTasks(p)).toHaveLength(3);
  });
});

describe("projectTally", () => {
  it("tallies done / active / parked (blocked) / total across streams", () => {
    const p = project([
      stream("active", ["done", "active", "blocked"]),
      stream("queued", ["done", "queued"]),
    ]);
    expect(projectTally(p)).toEqual({ done: 2, active: 1, parked: 1, total: 5 });
  });

  it("guards an empty project", () => {
    expect(projectTally(project([]))).toEqual({ done: 0, active: 0, parked: 0, total: 0 });
  });
});

describe("currentTask", () => {
  it("prefers the task explicitly marked here", () => {
    const p: Project = project([
      {
        id: "s",
        name: "S",
        status: "active",
        tasks: [
          { name: "a", status: "active" },
          { name: "b", status: "active", here: true },
        ],
      },
    ]);
    expect(currentTask(p)?.name).toBe("b");
  });

  it("falls back to the first active task", () => {
    expect(currentTask(project([stream("active", ["done", "active", "active"])]))?.name).toBe("t1");
  });

  it("returns undefined when nothing is in flight", () => {
    expect(currentTask(project([stream("done", ["done", "queued"])]))).toBeUndefined();
  });
});

describe("taskIconName", () => {
  it("maps every task status to an icon name", () => {
    expect(taskIconName).toEqual({
      done: "checkCircle",
      active: "circleDot",
      blocked: "diamond",
      queued: "circle",
    });
  });
});
