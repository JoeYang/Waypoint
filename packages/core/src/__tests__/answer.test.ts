import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError, StaleVersionError } from "../errors.js";

const PROJECT = "proj-1";

describe("answer — answering an OPEN ask", () => {
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

  const parkDecision = () =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });

  const parkQuestion = () =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "Which region?",
      required: true,
      options: [],
    });

  it("answers a decision by recording the chosen option, atomically with its event", async () => {
    const ask = await parkDecision();
    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      chosenOptionId: "opt-1",
    });

    expect(answered.state).toBe("ANSWERED");
    expect(answered.chosenOptionId).toBe("opt-1");
    expect(answered.version).toBe(2);
    const events = await backend.events.listSince(PROJECT, 0);
    const answerEvents = events.filter((e) => e.verb === "ask.answered");
    expect(answerEvents).toHaveLength(1);
    expect(answerEvents[0]).toMatchObject({ actor: "human", ref: { kind: "ask", id: ask.id } });
  });

  it("answers a question with free text", async () => {
    const ask = await parkQuestion();
    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      answerText: "us-east-1",
    });
    expect(answered.state).toBe("ANSWERED");
    expect(answered.answerText).toBe("us-east-1");
  });

  it("rejects a decision answer whose option id is not on the ask", async () => {
    const ask = await parkDecision();
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, chosenOptionId: "opt-9" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.asks.findById(PROJECT, ask.id)).toMatchObject({ state: "OPEN", version: 1 });
  });

  it("rejects a decision answer with no option chosen", async () => {
    const ask = await parkDecision();
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a question answer with no text", async () => {
    const ask = await parkQuestion();
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects answering an ask that is not OPEN", async () => {
    const ask = await parkDecision();
    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, chosenOptionId: "opt-1" });
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 2, chosenOptionId: "opt-2" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a stale answer and changes nothing", async () => {
    const ask = await parkDecision();
    await expect(
      core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 99, chosenOptionId: "opt-1" }),
    ).rejects.toBeInstanceOf(StaleVersionError);
    expect(await backend.asks.findById(PROJECT, ask.id)).toMatchObject({ state: "OPEN", version: 1 });
  });
});
