import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME } from "@waypoint/shared";

// Inserts the single default project this slice operates on. Idempotent — safe to run
// repeatedly. Separate from the schema migration (data, not structure).
export async function seedDefaultProject(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO project (id, name, seq_counter, created_at)
     VALUES ($1, $2, 0, $3)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, Date.now()],
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString, application_name: "waypoint-seed" });
  try {
    await seedDefaultProject(pool);
    console.log(`seeded project ${DEFAULT_PROJECT_ID}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
