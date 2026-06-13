import { describe, it, expect, beforeEach } from "vitest";
import { createCore, type Core } from "../core.js";
import { NotFoundError } from "../errors.js";
import { InMemoryBackend, FakeClock, FakeIdGenerator } from "../testing/in-memory.js";

const PROJECT = "proj-1";

// The inbox read model (task 6.1): the human's ranked queue of asks still awaiting a
// decision. Membership = unresolved asks (OPEN or ASSUMED); ranking = blast_radius desc,
// ties broken by oldest parkedAt. Returns the shared InboxResponse DTO directly.
describe("listInbox — ranked human decision queue", () => {
  let backend: InMemoryBackend;
  let clock: FakeClock;
  let core: Core;

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  const park = (nodeId: string, prompt: string) =>
    core.parkAsk({
      projectId: PROJECT,
      nodeId,
      type: "QUESTION",
      prompt,
      required: true,
      options: [],
    });

  beforeEach(() => {
    backend = new InMemoryBackend();
    clock = new FakeClock(1_000);
    core = createCore({ uow: backend.uow, clock, ids: new FakeIdGenerator("x") });
    backend.seedProject({ id: PROJECT, name: "Waypoint", createdAt: 0 });
  });

  it("returns an empty, seq-0 inbox for a project with no activity", async () => {
    const res = await core.listInbox(PROJECT);
    expect(res).toMatchObject({ projectId: PROJECT, seq: 0, items: [] });
  });

  it("ranks asks by the blast radius of their owning node, descending", async () => {
    const high = await task("widely blocking");
    const low = await task("isolated");
    // `high` gates two other nodes; `low` gates none.
    for (const t of ["dep-a", "dep-b"]) {
      const dependent = await task(t);
      await core.addDependency({ projectId: PROJECT, nodeId: dependent.id, dependsOnId: high.id });
    }
    const lowAsk = await park(low.id, "low-stakes?");
    const highAsk = await park(high.id, "high-stakes?");

    const res = await core.listInbox(PROJECT);
    expect(res.items.map((i) => i.askId)).toEqual([highAsk.id, lowAsk.id]);
    expect(res.items[0]).toMatchObject({ blastRadius: 2, nodeTitle: "widely blocking" });
    expect(res.items[1]).toMatchObject({ blastRadius: 0 });
  });

  it("breaks blast-radius ties by oldest parkedAt first", async () => {
    const n1 = await task("n1");
    const n2 = await task("n2");
    clock.tick(); // older ask
    const older = await park(n1.id, "asked first");
    clock.tick();
    const newer = await park(n2.id, "asked second");

    const res = await core.listInbox(PROJECT);
    expect(res.items.map((i) => i.askId)).toEqual([older.id, newer.id]);
    expect(res.items[0]!.parkedAt).toBeLessThan(res.items[1]!.parkedAt);
  });

  it("includes OPEN and ASSUMED asks but excludes resolved (ANSWERED) ones", async () => {
    const n = await task("n");
    const open = await park(n.id, "still open");
    const assumed = await park(n.id, "proceeding on a guess");
    await core.assume({
      projectId: PROJECT,
      askId: assumed.id,
      assumption: "assume yes",
      expectedVersion: 1,
    });
    const answered = await park(n.id, "already answered");
    await core.answer({
      projectId: PROJECT,
      askId: answered.id,
      expectedVersion: 1,
      answerText: "done",
    });

    const res = await core.listInbox(PROJECT);
    const ids = res.items.map((i) => i.askId);
    expect(ids).toContain(open.id);
    expect(ids).toContain(assumed.id);
    expect(ids).not.toContain(answered.id);
    expect(res.items.find((i) => i.askId === assumed.id)!.state).toBe("ASSUMED");
  });

  it("projects the full InboxItem shape from ask + owning node", async () => {
    const n = await task("the node");
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: n.id,
      type: "DECISION",
      prompt: "pick one",
      required: true,
      options: ["Postgres", "SQLite"],
    });

    const res = await core.listInbox(PROJECT);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      askId: ask.id,
      nodeId: n.id,
      nodeTitle: "the node",
      type: "DECISION",
      state: "OPEN",
      prompt: "pick one",
      required: true,
      options: [
        { id: "opt-1", label: "Postgres" },
        { id: "opt-2", label: "SQLite" },
      ],
      blastRadius: 0,
      askVersion: 1,
      nodeVersion: 1,
    });
    expect(res.items[0]!.parkedAt).toBe(ask.createdAt);
  });

  it("reports the project's latest event seq at read time", async () => {
    const n = await task("n");
    await park(n.id, "q");
    const res = await core.listInbox(PROJECT);
    // Two mutations so far (node.created, ask.parked) → seq 2.
    expect(res.seq).toBe(2);
  });

  it("rejects an unknown project with NotFoundError", async () => {
    await expect(core.listInbox("ghost")).rejects.toBeInstanceOf(NotFoundError);
  });
});
