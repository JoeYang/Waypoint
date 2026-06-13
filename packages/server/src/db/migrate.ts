import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at bigint NOT NULL)",
  );
}

// Applies every *.up.sql not yet recorded, each in its own transaction. Returns the
// ids that were applied this run (empty if already up to date). Idempotent.
export async function applyMigrations(pool: Pool): Promise<string[]> {
  await ensureTable(pool);
  const result = await pool.query<{ id: string }>("SELECT id FROM schema_migrations");
  const applied = new Set(result.rows.map((r) => r.id));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".up.sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    const id = file.replace(/\.up\.sql$/, "");
    if (applied.has(id)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [
        id,
        Date.now(),
      ]);
      await client.query("COMMIT");
      ran.push(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  return ran;
}

// Reverts the most recently applied migration via its .down.sql. Returns the id reverted.
export async function revertLast(pool: Pool): Promise<string | null> {
  await ensureTable(pool);
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1",
  );
  const last = result.rows[0]?.id;
  if (last === undefined) return null;
  const sql = readFileSync(join(MIGRATIONS_DIR, `${last}.down.sql`), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("DELETE FROM schema_migrations WHERE id = $1", [last]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return last;
}

async function main(): Promise<void> {
  // Self-contained pool so this file runs under `node --experimental-strip-types` with
  // no local .ts imports to resolve. The server uses createPool() from ./pool.js.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString, application_name: "waypoint-migrate" });
  try {
    if (process.argv[2] === "down") {
      const reverted = await revertLast(pool);
      console.log(reverted ? `reverted ${reverted}` : "nothing to revert");
    } else {
      const ran = await applyMigrations(pool);
      console.log(ran.length > 0 ? `applied ${ran.join(", ")}` : "already up to date");
    }
  } finally {
    await pool.end();
  }
}

// Run only when invoked directly (npm run db:migrate), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
