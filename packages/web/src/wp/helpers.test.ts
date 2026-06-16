import { describe, it, expect } from "vitest";
import { streamProgress, streamBarColor, taskIconName } from "./helpers.js";
import type { Stream } from "./types.js";

const stream = (
  status: Stream["status"],
  statuses: Stream["tasks"][number]["status"][],
): Stream => ({
  id: "s",
  name: "S",
  status,
  tasks: statuses.map((s, i) => ({ name: `t${i}`, status: s })),
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
