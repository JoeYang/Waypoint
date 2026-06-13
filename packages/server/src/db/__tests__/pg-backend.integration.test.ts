import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import { createCore, type Core, StaleVersionError, ValidationError } from "@waypoint/core";
import { createPgBackend } from "../pg-backend.js";
import { applyMigrations } from "../migrate.js";

const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT = "default";

// Integration tests need a real Postgres. Without DATABASE_URL the suite is skipped so
// `npm test` stays green everywhere; set it (e.g. the dev docker-compose db) to run them.
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb("PgBackend satisfies the repository port contract", () => {
  let pool: Pool;
  let core: Core;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await applyMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE event, dependency, ask, node RESTART IDENTITY CASCADE");
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
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
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

  it("assigns a monotonic per-project event seq in the database", async () => {
    const node = await task("T");
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
    const events = await pool.query<{ seq: string }>(
      "SELECT seq FROM event WHERE project_id = $1 ORDER BY seq",
      [PROJECT],
    );
    expect(events.rows.map((r) => Number(r.seq))).toEqual([1, 2]);
  });

  it("enforces optimistic concurrency against the stored version", async () => {
    const node = await task("T");
    await core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 });
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
    await core.answer({ projectId: PROJECT, askId: ask.id, expectedVersion: 1, answerText: "us-east-1" });

    const pack = await core.getContext(PROJECT);
    expect(pack.goal).toBe("Ship MVP");
    expect(pack.openAsks).toHaveLength(0);
    expect(pack.recentDecisions.map((d) => d.resolution)).toContain("us-east-1");
  });
});
