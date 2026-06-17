import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

// live-wiring PR2: the cross-project home read model — every project with read-time counts.
describe("listProjects — cross-project summaries", () => {
  let backend: InMemoryBackend;
  let core: Core;

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: "p1", name: "orbit-api", createdAt: 0 });
    backend.seedProject({ id: "p2", name: "atlas-web", createdAt: 1 });
  });

  it("derives open-ask and agent-task counts per project, and last activity", async () => {
    const node = await core.createNode({
      projectId: "p1",
      parentId: null,
      kind: "task",
      title: "T",
    });
    await core.transition({ projectId: "p1", nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
    await core.parkAsk({
      projectId: "p1",
      nodeId: node.id,
      type: "DECISION",
      prompt: "Which?",
      required: true,
      options: ["A", "B"],
    });

    const { projects } = await core.listProjects();
    const p1 = projects.find((p) => p.id === "p1");
    const p2 = projects.find((p) => p.id === "p2");

    expect(p1).toMatchObject({ name: "orbit-api", openAskCount: 1, agentTaskCount: 1 });
    expect(p1?.lastActivityAt).toBeGreaterThan(0);
    expect(p2).toMatchObject({ openAskCount: 0, agentTaskCount: 0 });
    expect(p2?.lastActivityAt).toBeUndefined();
  });

  it("lists every project, including empty ones", async () => {
    const { projects } = await core.listProjects();
    expect(projects.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });
});
