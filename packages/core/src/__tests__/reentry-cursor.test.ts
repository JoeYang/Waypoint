import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";
import { NotFoundError } from "../errors.js";
import { DEFAULT_NOTIFICATION_POLICY } from "@waypoint/shared";

const PROJECT = "proj-1";
const PRINCIPAL = "__default__";

function harness() {
  const backend = new InMemoryBackend();
  const core = createCore({
    uow: backend.uow,
    clock: new FakeClock(1_000),
    ids: new FakeIdGenerator("n"),
  });
  backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  return { backend, core };
}

describe("core.digestFor — cursor-aware re-entry", () => {
  let core: Core;
  beforeEach(() => {
    ({ core } = harness());
  });

  it("projects the full digest for a principal that has never visited (cursor 0)", async () => {
    const t = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "ship",
    });
    await core.transition({ projectId: PROJECT, nodeId: t.id, to: "ACTIVE", expectedVersion: 1 });
    await core.transition({ projectId: PROJECT, nodeId: t.id, to: "DONE", expectedVersion: 2 });
    const d = await core.digestFor(PROJECT, PRINCIPAL);
    expect(d.sinceSeq).toBe(0);
    expect(d.shipped.map((n) => n.nodeId)).toContain(t.id);
  });

  it("only reports change since the acked cursor", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    const seq = (await core.readEvents(PROJECT)).seq;
    await core.ackDigest(PROJECT, PRINCIPAL, seq);
    // New work after the ack.
    const b = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "B",
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: b.id,
      type: "QUESTION",
      prompt: "?",
      required: true,
      options: [],
    });
    const d = await core.digestFor(PROJECT, PRINCIPAL);
    expect(d.sinceSeq).toBe(seq);
    expect(d.newlyBlocked.map((n) => n.nodeId)).toEqual([b.id]);
  });

  it("does not advance the cursor on read (stable across repeated reads)", async () => {
    await core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title: "A" });
    const first = await core.digestFor(PROJECT, PRINCIPAL);
    const second = await core.digestFor(PROJECT, PRINCIPAL);
    expect(second.sinceSeq).toBe(first.sinceSeq);
    expect(second.shipped).toEqual(first.shipped);
  });

  it("rejects an unknown project", async () => {
    await expect(core.digestFor("ghost", PRINCIPAL)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("core.ackDigest — monotonic cursor", () => {
  let core: Core;
  beforeEach(() => {
    ({ core } = harness());
  });

  it("advances the cursor and reports the new position", async () => {
    expect((await core.ackDigest(PROJECT, PRINCIPAL, 5)).lastSeenSeq).toBe(5);
  });

  it("never moves the cursor backward (ack to an older seq is a no-op)", async () => {
    await core.ackDigest(PROJECT, PRINCIPAL, 10);
    expect((await core.ackDigest(PROJECT, PRINCIPAL, 3)).lastSeenSeq).toBe(10);
  });

  it("is idempotent at the same seq", async () => {
    await core.ackDigest(PROJECT, PRINCIPAL, 7);
    expect((await core.ackDigest(PROJECT, PRINCIPAL, 7)).lastSeenSeq).toBe(7);
  });

  it("rejects an unknown project", async () => {
    await expect(core.ackDigest("ghost", PRINCIPAL, 1)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("core.policyFor / setPolicyFor", () => {
  let core: Core;
  beforeEach(() => {
    ({ core } = harness());
  });

  it("returns the application default when the principal has set no policy", async () => {
    expect(await core.policyFor(PROJECT, PRINCIPAL)).toEqual(DEFAULT_NOTIFICATION_POLICY);
  });

  it("returns the stored policy after it is set", async () => {
    const policy = { blastRadiusThreshold: 1, ageSlaSeconds: 60, digestCadenceSeconds: 3600 };
    await core.setPolicyFor(PROJECT, PRINCIPAL, policy);
    expect(await core.policyFor(PROJECT, PRINCIPAL)).toEqual(policy);
  });

  it("scopes the policy per principal", async () => {
    await core.setPolicyFor(PROJECT, "alice", {
      blastRadiusThreshold: 9,
      ageSlaSeconds: 9,
      digestCadenceSeconds: 9,
    });
    expect(await core.policyFor(PROJECT, "bob")).toEqual(DEFAULT_NOTIFICATION_POLICY);
  });

  it("rejects setting a policy on an unknown project", async () => {
    await expect(
      core.setPolicyFor("ghost", PRINCIPAL, DEFAULT_NOTIFICATION_POLICY),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
