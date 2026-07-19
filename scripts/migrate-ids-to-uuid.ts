import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing rows with non-UUID text IDs (users will need to log in again)
    await client.query(`TRUNCATE TABLE "session" CASCADE`);
    await client.query(`TRUNCATE TABLE "account" CASCADE`);
    await client.query(`TRUNCATE TABLE "verification" CASCADE`);
    console.log("✓ Cleared existing session/account/verification data");

    // Alter session.id from text to uuid
    await client.query(`
      ALTER TABLE "session"
        ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid,
        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    `);
    console.log("✓ session.id migrated to uuid");

    // Alter account.id from text to uuid
    await client.query(`
      ALTER TABLE "account"
        ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid,
        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    `);
    console.log("✓ account.id migrated to uuid");

    // Alter verification.id from text to uuid
    await client.query(`
      ALTER TABLE "verification"
        ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid,
        ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    `);
    console.log("✓ verification.id migrated to uuid");

    await client.query("COMMIT");
    console.log("\n✅ Migration complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
