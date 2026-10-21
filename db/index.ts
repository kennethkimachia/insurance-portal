import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// A pooled PostgreSQL connection supports the transactions needed for enrollment,
// submission and assignment. Creating the pool does not connect or mutate data.
const globalDb = globalThis as unknown as { insurancePool?: Pool };
const pool =
  globalDb.insurancePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    options: "-c timezone=UTC",
  });
if (process.env.NODE_ENV !== "production") globalDb.insurancePool = pool;
const db = drizzle({ client: pool, schema });

export { db };
