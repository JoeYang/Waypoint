import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import { createCore, type Core, StaleVersionError, ValidationError } from "@waypoint/core";
import { createPgBackend } from "../pg-backend.js";
import { applyMigrations } from "../migrate.js";

// A SEPARATE database from DATABASE_URL: these tests TRUNCATE between cases, so they must
// never run against the dogfood/dev database. Set WAYPOINT_TEST_DATABASE_URL to a
// throwaway test db to run them; unset, the suite is skipped so `npm test` stays green.
const TEST_DATABASE_URL = process.env.WAYPOINT_TEST_DATABASE_URL;
const PROJECT = "default";

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("PgBackend satisfies the repository port contract", () => {
  let pool: Pool;
  let core: Core;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    await applyMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE event, dependency, ask, node, principal_cursor, notification_policy RESTART IDENTITY CASCADE",
    );
    await pool.query(
      `INSERT INTO project (id, name, seq_counter, created_at) VALUES ($1,$2,0,0)
       ON CONFLICT (id) DO UPDATE SET seq_counter = 0`,
      [PROJECT, "Waypoint"],
    );
    let n = 0;
    const ids = { generate: () => `id-${(n += 1)}` };
    const clock = { now: () => 1_000 };
    core = createCore({ uow: createPgBackend(pool).uow, clock, ids });
  });

  const task = (title: string) =>
    core.createNode({ projectId: PROJECT, parentId: null, kind: "task", title });

  it("persists a node and reads it back in a later transaction", async () => {
    const node = await task("Ship it");
    const { rows } = await pool.query("SELECT status, version FROM node WHERE id = $1", [node.id]);
    expect(rows[0]).toMatchObject({ status: "DRAFT", version: 1 });
  });

  it("runs the full park → answer → unblock lifecycle across transactions", async () => {
    const node = await task("T");
    await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Postgres or SQLite?",
      required: true,
      options: ["Postgres", "SQLite"],
    });
    expect(await core.computeBlocked(PROJECT, node.id)).toBe(true);

    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      chosenOptionId: "opt-1",
    });
    expect(answered.state).toBe("ANSWERED");
    expect(answered.chosenOptionId).toBe("opt-1");
    expect(await core.computeBlocked(PROJECT, node.id)).toBe(false);
  });

  it("aggregates project summaries in one query and reads the event log", async () => {
    const node = await task("T");
    await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Which store?",
      required: true,
      options: ["Postgres", "SQLite"],
    });

    const { projects } = await core.listProjects();
    const summary = projects.find((p) => p.id === PROJECT);
    expect(summary).toMatchObject({ openAskCount: 1, agentTaskCount: 1 });
    expect(summary?.lastActivityAt).toBeGreaterThan(0);

    const log = await core.readEvents(PROJECT);
    expect(log.events.map((e) => e.verb)).toEqual([
      "node.created",
      "node.transitioned",
      "ask.parked",
    ]);
    expect(log.seq).toBe(log.events[log.events.length - 1]?.seq);
  });

  it("round-trips decision context (rationale, per-option consequence, agent label) across transactions", async () => {
    const node = await task("decide the store");
    const parked = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "DECISION",
      prompt: "Which store?",
      required: true,
      rationale: "retry-safety matters for the queue",
      options: [
        { label: "Postgres", consequence: "stable across retries" },
        { label: "SQLite", consequence: "no concurrency" },
      ],
      agentLabel: "checkout-agent",
      sessionId: "sess-1",
    });

    // Re-read through a fresh transaction via the read model — the fields must survive the
    // Postgres round-trip, not just live in the value core returned from the write.
    const inbox = await core.listInbox(PROJECT);
    const item = inbox.items.find((i) => i.askId === parked.id);
    expect(item).toBeDefined();
    expect(item!.rationale).toBe("retry-safety matters for the queue");
    expect(item!.options).toEqual([
      { id: "opt-1", label: "Postgres", consequence: "stable across retries" },
      { id: "opt-2", label: "SQLite", consequence: "no concurrency" },
    ]);
    expect(item!.parkedBy?.agentLabel).toBe("checkout-agent");

    const { rows } = await pool.query("SELECT rationale, agent_label FROM ask WHERE id = $1", [
      parked.id,
    ]);
    expect(rows[0]).toMatchObject({
      rationale: "retry-safety matters for the queue",
      agent_label: "checkout-agent",
    });
  });

  it("round-trips suggested answers on a QUESTION", async () => {
    const node = await task("sampling rate?");
    const parked = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "QUESTION",
      prompt: "What sampling rate?",
      required: false,
      options: [],
      suggestedAnswers: ["100%", "10%"],
    });
    const inbox = await core.listInbox(PROJECT);
    const item = inbox.items.find((i) => i.askId === parked.id);
    expect(item!.suggestedAnswers).toEqual(["100%", "10%"]);
  });

  it("persists an adjusted proposal's constraint as the answer text", async () => {
    const node = await task("replace the poller");
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: node.id,
      type: "PROPOSAL",
      prompt: "Replace the poller with a webhook?",
      required: true,
      options: [],
    });
    const answered = await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      proposalVerdict: "adjust",
      adjustmentNote: "keep the poller for 30d",
    });
    expect(answered.answerText).toBe("keep the poller for 30d");

    const { rows } = await pool.query("SELECT answer_text FROM ask WHERE id = $1", [ask.id]);
    expect(rows[0]).toMatchObject({ answer_text: "keep the poller for 30d" });
  });

  it("assigns a monotonic per-project event seq in the database", async () => {
    const node = await task("T");
    await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    const events = await pool.query<{ seq: string }>(
      "SELECT seq FROM event WHERE project_id = $1 ORDER BY seq",
      [PROJECT],
    );
    expect(events.rows.map((r) => Number(r.seq))).toEqual([1, 2]);
  });

  it("enforces optimistic concurrency against the stored version", async () => {
    const node = await task("T");
    await core.transition({
      projectId: PROJECT,
      nodeId: node.id,
      to: "ACTIVE",
      expectedVersion: 1,
    });
    await expect(
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "DONE", expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("computes blast_radius from real dependency rows", async () => {
    const a = await task("A");
    for (const t of ["B", "C", "D"]) {
      const dependent = await task(t);
      await core.addDependency({ projectId: PROJECT, nodeId: dependent.id, dependsOnId: a.id });
    }
    expect(await core.blastRadius(PROJECT, a.id)).toBe(3);
  });

  it("rejects a cyclic dependency persisted in Postgres", async () => {
    const a = await task("A");
    const b = await task("B");
    await core.addDependency({ projectId: PROJECT, nodeId: a.id, dependsOnId: b.id });
    await expect(
      core.addDependency({ projectId: PROJECT, nodeId: b.id, dependsOnId: a.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("assembles a context pack over Postgres (reads share one connection, no concurrency)", async () => {
    const goal = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship MVP",
    });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: goal.id,
      type: "QUESTION",
      prompt: "Which region?",
      required: true,
      options: [],
    });
    await core.answer({
      projectId: PROJECT,
      askId: ask.id,
      expectedVersion: 1,
      answerText: "us-east-1",
    });

    const pack = await core.getContext(PROJECT);
    expect(pack.goal).toBe("Ship MVP");
    expect(pack.openAsks).toHaveLength(0);
    expect(pack.recentDecisions.map((d) => d.resolution)).toContain("us-east-1");
  });

  it("assembles the project spine over Postgres with correct rollups", async () => {
    const goal = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Ship checkout",
    });
    const plan = await core.createNode({
      projectId: PROJECT,
      parentId: goal.id,
      kind: "plan",
      title: "Refunds",
    });
    const cache = await core.createNode({
      projectId: PROJECT,
      parentId: plan.id,
      kind: "task",
      title: "cache",
    });
    const refunds = await core.createNode({
      projectId: PROJECT,
      parentId: plan.id,
      kind: "task",
      title: "refund worker",
    });
    await core.addDependency({ projectId: PROJECT, nodeId: refunds.id, dependsOnId: cache.id });
    const ask = await core.parkAsk({
      projectId: PROJECT,
      nodeId: cache.id,
      type: "DECISION",
      prompt: "which cache?",
      required: true,
      rationale: "blocks refunds",
      options: [
        { label: "redis", consequence: "fast" },
        { label: "pg", consequence: "durable" },
      ],
      agentLabel: "checkout-agent",
    });

    const progress = await core.listProject(PROJECT);
    expect(progress.goals).toHaveLength(1);
    const g = progress.goals[0]!;
    // cache is blocked-on-ask; refund worker is still running (task state reflects asks, not
    // transitive dependency-blocking in slice 2) → the goal is at-risk, not fully blocked.
    expect(g.state).toBe("at-risk");
    expect(g.plans[0]!.state).toBe("blocked");
    const cacheTask = g.plans[0]!.tasks.find((t) => t.nodeId === cache.id)!;
    expect(cacheTask.state).toBe("blocked-on-ask");
    expect(cacheTask.blastRadius).toBe(1);
    expect(cacheTask.asks[0]).toMatchObject({
      askId: ask.id,
      rationale: "blocks refunds",
      goalTitle: "Ship checkout",
      options: [
        { id: "opt-1", label: "redis", consequence: "fast" },
        { id: "opt-2", label: "pg", consequence: "durable" },
      ],
    });
  });

  it("computes the spine within the interactive budget on a 50+ node tree (no N+1)", async () => {
    // Seed a realistic tree: 1 goal, 5 plans, 10 tasks each (55 nodes), cross-plan deps and
    // a scatter of open asks. The read model must not degrade as the tree grows.
    const goal = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "goal",
      title: "Big goal",
    });
    const firstTaskOfPlan: string[] = [];
    for (let p = 0; p < 5; p += 1) {
      const plan = await core.createNode({
        projectId: PROJECT,
        parentId: goal.id,
        kind: "plan",
        title: `plan ${p}`,
      });
      for (let t = 0; t < 10; t += 1) {
        const task = await core.createNode({
          projectId: PROJECT,
          parentId: plan.id,
          kind: "task",
          title: `task ${p}.${t}`,
        });
        if (t === 0) firstTaskOfPlan.push(task.id);
        if (t % 4 === 0) {
          await core.parkAsk({
            projectId: PROJECT,
            nodeId: task.id,
            type: "QUESTION",
            prompt: `q ${p}.${t}`,
            required: true,
            options: [],
          });
        }
      }
    }
    // Cross-plan dependency graph (non-trivial blast radii).
    for (let i = 1; i < firstTaskOfPlan.length; i += 1) {
      await core.addDependency({
        projectId: PROJECT,
        nodeId: firstTaskOfPlan[i]!,
        dependsOnId: firstTaskOfPlan[0]!,
      });
    }

    const RUNS = 20;
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const start = performance.now();
      await core.listProject(PROJECT);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(0.95 * (RUNS - 1))]!;
    // Budget is p95 < 150 ms; surface the real number for the record.
    console.log(`listProject p95 over 55-node tree: ${p95.toFixed(1)}ms (budget 150ms)`);
    expect(p95).toBeLessThan(150);
  });

  // --- Re-entry cursor + notification policy (slice 3) ---
  const PRINCIPAL = "__default__";

  it("defaults the read cursor to 0 for a principal that has never visited", async () => {
    const d = await core.digestFor(PROJECT, PRINCIPAL);
    expect(d.sinceSeq).toBe(0);
  });

  it("persists the cursor across transactions and advances it monotonically", async () => {
    await core.ackDigest(PROJECT, PRINCIPAL, 4);
    expect((await core.ackDigest(PROJECT, PRINCIPAL, 2)).lastSeenSeq).toBe(4); // no backward move
    const { rows } = await pool.query(
      "SELECT last_seen_seq FROM principal_cursor WHERE principal = $1 AND project_id = $2",
      [PRINCIPAL, PROJECT],
    );
    expect(Number(rows[0]?.last_seen_seq)).toBe(4);
  });

  it("round-trips a notification policy and upserts on re-set", async () => {
    await core.setPolicyFor(PROJECT, PRINCIPAL, {
      blastRadiusThreshold: 2,
      ageSlaSeconds: 120,
      digestCadenceSeconds: 3600,
    });
    expect(await core.policyFor(PROJECT, PRINCIPAL)).toEqual({
      blastRadiusThreshold: 2,
      ageSlaSeconds: 120,
      digestCadenceSeconds: 3600,
    });
    // Re-set upserts the single (principal, project) row rather than inserting a duplicate.
    await core.setPolicyFor(PROJECT, PRINCIPAL, {
      blastRadiusThreshold: 9,
      ageSlaSeconds: 9,
      digestCadenceSeconds: 9,
    });
    const { rows } = await pool.query(
      "SELECT count(*)::int AS c FROM notification_policy WHERE principal = $1 AND project_id = $2",
      [PRINCIPAL, PROJECT],
    );
    expect(rows[0]?.c).toBe(1);
    expect((await core.policyFor(PROJECT, PRINCIPAL)).blastRadiusThreshold).toBe(9);
  });
});
