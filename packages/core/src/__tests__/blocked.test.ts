import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";

const PROJECT = "proj-1";

describe("computed blocked", () => {
  let backend: InMemoryBackend;
  let core: Core;

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  // Independent reference computation the use-case must always agree with.
  async function referenceBlocked(nodeId: string): Promise<boolean> {
    const asks = await backend.asks.listByProject(PROJECT);
    if (asks.some((a) => a.nodeId === nodeId && a.required && a.state === "OPEN")) return true;
    const edges = await backend.nodes.listDependencies(PROJECT);
    const nodes = await backend.nodes.listByProject(PROJECT);
    const status = new Map(nodes.map((n) => [n.id, n.status]));
    return edges.filter((e) => e.nodeId === nodeId).some((e) => status.get(e.dependsOnId) !== "DONE");
  }

  beforeEach(() => {
    backend = new InMemoryBackend();
    core = createCore({
      uow: backend.uow,
      clock: new FakeClock(1_000),
      ids: new FakeIdGenerator("x"),
    });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("is blocked by an OPEN required ask and unblocked once it is answered", async () => {
    const n = await task("T");
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: n.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    expect(await core.computeBlocked(PROJECT, n.id)).toBe(true);

    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "yes" });
    expect(await core.computeBlocked(PROJECT, n.id)).toBe(false);
  });

  it("is not blocked by an ASSUMED required ask", async () => {
    const n = await task("T");
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: n.id,
      type: "DECISION",
      prompt: "p",
      required: true,
      options: ["a", "b"],
    });
    await core.assume({ projectId: PROJECT, askId: ask.id, assumption: "a", expectedVersion: 1 });
    expect(await core.computeBlocked(PROJECT, n.id)).toBe(false);
  });

  it("is not blocked by a non-required OPEN ask", async () => {
    const n = await task("T");
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: n.id,
      type: "QUESTION",
      prompt: "fyi",
      required: false,
      options: [],
    });
    expect(await core.computeBlocked(PROJECT, n.id)).toBe(false);
  });

  it("is blocked by an unmet dependency and unblocked when the dependency is DONE", async () => {
    const a = await task("A");
    const b = await task("B");
    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id });
    expect(await core.computeBlocked(PROJECT, b.id)).toBe(true);

    await core.transition({ projectId: PROJECT, nodeId: a.id, to: "ACTIVE", expectedVersion: 1 });
    await core.transition({ projectId: PROJECT, nodeId: a.id, to: "DONE", expectedVersion: 2 });
    expect(await core.computeBlocked(PROJECT, b.id)).toBe(false);
  });

  it("agrees with the reference computation after a sequence of mutations", async () => {
    const a = await task("A");
    const b = await task("B");
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: b.id,
      type: "QUESTION",
      prompt: "q",
      required: true,
      options: [],
    });
    await core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id });

    const check = async () => {
      for (const id of [a.id, b.id]) {
        expect(await core.computeBlocked(PROJECT, id)).toBe(await referenceBlocked(id));
      }
    };
    await check();
    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "x" });
    await check();
    await core.transition({ projectId: PROJECT, nodeId: a.id, to: "ACTIVE", expectedVersion: 1 });
    await check();
    await core.transition({ projectId: PROJECT, nodeId: a.id, to: "DONE", expectedVersion: 2 });
    await check();
  });

  it("rejects an unknown node", async () => {
    await expect(core.computeBlocked(PROJECT, "ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});
