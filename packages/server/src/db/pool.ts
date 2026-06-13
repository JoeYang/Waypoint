import { Pool } from "pg";

// Bounded connection pool built from DATABASE_URL (never a hardcoded credential).
// Sized for expected concurrency per database.md; callers own the pool's lifecycle.
export function createPool(connectionString: string | undefined = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const max = Number(process.env.WAYPOINT_DB_POOL_MAX ?? "10");
  return new Pool({ connectionString, max, application_name: "waypoint" });
}
