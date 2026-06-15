import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { ValidationError } from "../errors.js";

const PROJECT = "proj-1";

// V2 slice 1 (decision-context-and-actions), task 3 — parking behaviour over in-memory fakes.
// Park persists decision context (rationale, per-option consequence, suggested answers) and a
// stable agent provenance label.

describe("parkAsk — persists decision context (task 3.1)", () => {
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

  it("persists rationale and a per-option consequence on a DECISION", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      rationale: "retry-safety matters for the queue",
      options: [
        { label: "Postgres", consequence: "stable across retries" },
        { label: "SQLite", consequence: "no concurrency" },
      ],
    });

    expect(ask.rationale).toBe("retry-safety matters for the queue");
    expect(ask.options).toEqual([
      { id: "opt-1", label: "Postgres", consequence: "stable across retries" },
      { id: "opt-2", label: "SQLite", consequence: "no concurrency" },
    ]);
  });

  it("persists suggestedAnswers on a QUESTION", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "What sampling rate?",
      required: false,
      options: [],
      suggestedAnswers: ["100%", "10%"],
    });
    expect(ask.suggestedAnswers).toEqual(["100%", "10%"]);
  });

  it("accepts a mix of bare-string and { label, consequence } options without inventing a consequence", async () => {
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "DECISION",
      prompt: "pick",
      required: true,
      options: ["Postgres", { label: "SQLite", consequence: "no concurrency" }],
    });
    // A bare-string option carries no `consequence` key at all (exactOptionalPropertyTypes).
    expect(ask.options).toEqual([
      { id: "opt-1", label: "Postgres" },
      { id: "opt-2", label: "SQLite", consequence: "no concurrency" },
    ]);
  });

  it("still rejects a DECISION with fewer than two options and persists nothing", async () => {
    await expect(
      core.parkAsk({
        projectId: PROJECT,
        nodeId,
        type: "DECISION",
        prompt: "pick",
        required: true,
        options: [{ label: "only one" }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await backend.asks.listByProject(PROJECT)).toHaveLength(0);
  });
});

describe("parkAsk — agent provenance (task 3.3)", () => {
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

  const park = (extra: { agentLabel?: string; sessionId?: string }) =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt: "q?",
      required: false,
      options: [],
      ...extra,
    });

  it("records an explicit agentLabel verbatim", async () => {
    const ask = await park({ agentLabel: "checkout-agent", sessionId: "sess-1" });
    expect(ask.agentLabel).toBe("checkout-agent");
  });

  it("derives a stable alias from the session when agentLabel is omitted (same session → same alias)", async () => {
    const a1 = await park({ sessionId: "sess-42" });
    const a2 = await park({ sessionId: "sess-42" });
    expect(a1.agentLabel).not.toBeNull();
    expect(a1.agentLabel).toBe(a2.agentLabel);
    // The alias is a friendly label, never the raw session id.
    expect(a1.agentLabel).not.toBe("sess-42");
  });

  it("leaves agentLabel null when neither a label nor a session is supplied", async () => {
    const ask = await park({});
    expect(ask.agentLabel).toBeNull();
  });
});
