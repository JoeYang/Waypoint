import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError, ValidationError } from "../errors.js";

const PROJECT = "proj-1";

describe("parkAsk — parking an ask on a node", () => {
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

  it("parks a required DECISION in OPEN with assigned option ids and one event", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });

    expect(ask.state).toBe("OPEN");
    expect(ask.type).toBe("DECISION");
    expect(ask.required).toBe(true);
    expect(ask.version).toBe(1);
    expect(ask.options).toEqual([
      { id: "opt-1", label: "Postgres" },
      { id: "opt-2", label: "SQLite" },
    ]);
    const events = await backend.events.listSince(PROJECT, 0);
    expect(events.at(-1)).toMatchObject({ verb: "ask.parked", ref: { kind: "ask", id: ask.id } });
  });

  it("parks a QUESTION with no options", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "Which region?",
      required: false,
      options: [],
    });
    expect(ask.type).toBe("QUESTION");
    expect(ask.options).toEqual([]);
    expect(ask.state).toBe("OPEN");
  });

  it("rejects a DECISION with fewer than two options and creates nothing", async () => {
    await expect(
      core.parkAsk({
        projectId: PROJECT,
        nodeId,
        type: "DECISION",
        prompt: "pick",
        required: true,
        options: ["only one"],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.asks.listByProject(PROJECT)).toHaveLength(0);
  });

  it("rejects parking on a node that does not exist", async () => {
    await expect(
      core.parkAsk({
        projectId: PROJECT,
        nodeId: "ghost",
        type: "QUESTION",
        prompt: "q",
        required: false,
        options: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
