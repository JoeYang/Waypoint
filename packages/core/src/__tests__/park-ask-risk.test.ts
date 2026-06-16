import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

const PROJECT = "proj-1";

// live-wiring group A (A.2): the agent declares risk + reversibility at park time; core stores
// them on the ask, defaults them when omitted, and surfaces them on the inbox item.
describe("parkAsk — agent-supplied risk + reversibility", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let nodeId: string;

  beforeEach(async () => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "T",
    });
    nodeId = node.id;
  });

  it("stores the agent's declared risk and reversibility", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Drop the table?",
      required: true,
      options: ["Drop", "Keep"],
      risk: "high",
      reversible: false,
    });
    expect(ask.risk).toBe("high");
    expect(ask.reversible).toBe(false);
  });

  it("defaults to medium risk and reversible when the agent omits them", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "Which name?",
      required: true,
      options: [],
    });
    expect(ask.risk).toBe("medium");
    expect(ask.reversible).toBe(true);
  });

  it("surfaces risk and reversibility on the inbox item", async () => {
    await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Drop the table?",
      required: true,
      options: ["Drop", "Keep"],
      risk: "high",
      reversible: false,
    });
    const res = await core.listInbox(PROJECT);
    const item = res.items.find((i) => i.nodeId === nodeId);
    expect(item?.risk).toBe("high");
    expect(item?.reversible).toBe(false);
  });
});
