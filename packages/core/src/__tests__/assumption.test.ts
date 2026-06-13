import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError, StaleVersionError } from "../errors.js";

const PROJECT = "proj-1";

describe("proceed-on-assumption — OPEN → ASSUMED → CONFIRMED/OVERTURNED", () => {
  let backend: InMemoryBackend;
  let core: Core;
  let nodeId: string;
  let askId: string;

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
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });
    askId = ask.id;
  });

  it("assumes an OPEN ask without touching the node version", async () => {
    const assumed = await core.assume({
      projectId: PROJECT,
      askId,
      assumption: "Postgres",
      expectedVersion: 1,
    });
    expect(assumed.state).toBe("ASSUMED");
    expect(assumed.assumption).toBe("Postgres");
    expect(assumed.version).toBe(2);
    expect(await backend.nodes.findById(PROJECT, nodeId)).toMatchObject({ version: 1 });
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "ask.assumed", actor: "agent" });
  });

  it("confirms an ASSUMED ask without bumping the node", async () => {
    await core.assume({ projectId: PROJECT, askId, assumption: "Postgres", expectedVersion: 1 });
    const confirmed = await core.confirmAssumption({ projectId: PROJECT, askId, expectedVersion: 2 });
    expect(confirmed.state).toBe("CONFIRMED");
    expect(confirmed.version).toBe(3);
    expect(await backend.nodes.findById(PROJECT, nodeId)).toMatchObject({ version: 1 });
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "ask.confirmed", actor: "human" });
  });

  it("overturns an ASSUMED ask, bumps the node for re-triage, emits an event", async () => {
    await core.assume({ projectId: PROJECT, askId, assumption: "Postgres", expectedVersion: 1 });
    const overturned = await core.overturnAssumption({
      projectId: PROJECT,
      askId,
      expectedVersion: 2,
    });
    expect(overturned.state).toBe("OVERTURNED");
    expect(overturned.version).toBe(3);
    // The node version is bumped so an in-flight agent write (e.g. → DONE) is rejected.
    expect(await backend.nodes.findById(PROJECT, nodeId)).toMatchObject({ version: 2 });
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "ask.overturned", actor: "human" });
  });

  it("rejects confirming an OPEN (never-assumed) ask", async () => {
    await expect(
      core.confirmAssumption({ projectId: PROJECT, askId, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects assuming an ask that is not OPEN", async () => {
    await core.assume({ projectId: PROJECT, askId, assumption: "Postgres", expectedVersion: 1 });
    await expect(
      core.assume({ projectId: PROJECT, askId, assumption: "again", expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a stale assume", async () => {
    await expect(
      core.assume({ projectId: PROJECT, askId, assumption: "Postgres", expectedVersion: 99 }),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });
});
