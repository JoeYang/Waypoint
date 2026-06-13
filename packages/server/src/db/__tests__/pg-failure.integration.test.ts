import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import {
  createCore,
  type Core,
  BackendUnavailableError,
  StaleVersionError,
} from "@waypoint/core";
import { createPgBackend } from "../pg-backend.js";
import { applyMigrations } from "../migrate.js";

// Separate test database (see pg-backend.integration.test.ts) — never the dogfood db.
const TEST_DATABASE_URL = process.env.WAYPOINT_TEST_DATABASE_URL;
const PROJECT = "default";

// Needs no real database — points at a refused port to exercise the unavailable path.
describe("PgBackend — unreachable database", () => {
  it("surfaces a typed BackendUnavailableError instead of leaking a driver error", async () => {
    const deadPool = new Pool({
      host: "127.0.0.1",
      port: 1,
      database: "nope",
      connectionTimeoutMillis: 500,
    });
    const { uow } = createPgBackend(deadPool);
    try {
      await expect(uow.run(async () => "unreachable")).rejects.toBeInstanceOf(
        BackendUnavailableError,
      );
    } finally {
      await deadPool.end();
    }
  });
});

const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

describeDb("PgBackend — failure injection against real Postgres", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
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
  });

  const makeCore = (): Core => {
    let n = 0;
    return createCore({
      uow: createPgBackend(pool).uow,
      clock: { now: () => 1_000 },
      ids: { generate: () => `id-${(n += 1)}` },
    });
  };

  it("rolls back a transaction that throws after a write — no partial state", async () => {
    const core = makeCore();
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "original",
    });

    const { uow } = createPgBackend(pool);
    await expect(
      uow.run(async (ctx) => {
        const fresh = await ctx.nodes.findById(PROJECT, node.id);
        if (!fresh) throw new Error("missing");
        await ctx.nodes.update({ ...fresh, title: "CHANGED", version: 99 });
        throw new Error("boom after write");
      }),
    ).rejects.toThrow("boom after write");

    const { rows } = await pool.query<{ title: string; version: number }>(
      "SELECT title, version FROM node WHERE id = $1",
      [node.id],
    );
    expect(rows[0]).toMatchObject({ title: "original", version: 1 });
  });

  it("degrades gracefully when the connection pool is exhausted", async () => {
    const tinyPool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 400,
    });
    const { uow } = createPgBackend(tinyPool);
    let release = (): void => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const first = uow.run(async () => {
        await held; // hold the only connection
        return "first";
      });
      // The second run cannot acquire a connection and fails as unavailable, not corrupt.
      await expect(uow.run(async () => "second")).rejects.toBeInstanceOf(BackendUnavailableError);
      release();
      expect(await first).toBe("first");
    } finally {
      release();
      await tinyPool.end();
    }
  });

  it("serialises concurrent writes to one node — exactly one wins, the other is stale", async () => {
    const core = makeCore();
    const node = await core.createNode({
      projectId: PROJECT,
      parentId: null,
      kind: "task",
      title: "contended",
    });

    // Two writers race from version 1; FOR UPDATE serialises them so the loser sees the
    // bumped version and is rejected as stale rather than clobbering the winner.
    const results = await Promise.allSettled([
      core.transition({ projectId: PROJECT, nodeId: node.id, to: "ACTIVE", expectedVersion: 1 }),
      core.transition({
        projectId: PROJECT,
        nodeId: node.id,
        to: "DISCARDED",
        reason: "lost the race",
        expectedVersion: 1,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(StaleVersionError);

    const { rows } = await pool.query<{ version: number }>(
      "SELECT version FROM node WHERE id = $1",
      [node.id],
    );
    expect(rows[0]?.version).toBe(2);
  });
});
