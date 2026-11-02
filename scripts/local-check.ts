import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import * as schema from "../db/schema";

export async function checkLocalStorage() {
  // This module is imported only after .env.local has been validated and loaded.
  const { getClaimStorage, getFileUrl, deleteFile } = await import("../lib/storage");
  const { s3, bucket: BUCKET } = getClaimStorage();
  const key = `_local-check/${randomUUID()}.txt`;
  const body = "Synthetic local storage check\n";
  try {
    // Mini pre-creates the bucket; retry briefly while its S3 gateway starts.
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    assert.ok(ready, "Local storage bucket is not ready. Check docker compose logs storage.");
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "text/plain" }));
    const url = await getFileUrl(key, 60);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200, "Presigned downloads must succeed.");
    assert.equal(await response.text(), body, "Uploaded and downloaded content must match.");
    const unsigned = new URL(url);
    unsigned.search = "";
    const denied = await fetch(unsigned, { signal: AbortSignal.timeout(10_000) });
    assert.ok([401, 403].includes(denied.status), "Evidence must not be readable anonymously.");
    await deleteFile(key);
    await assert.rejects(s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })), (error: unknown) =>
      typeof error === "object" && error !== null && "$metadata" in error &&
      (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404);
    console.log("Storage OK: private bucket, upload, presigned download, and deletion.");
  } finally {
    await deleteFile(key).catch(() => undefined);
    s3.destroy();
  }
}

export async function checkLocalServices() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const tables = Object.values(schema).filter((value) => is(value, PgTable)).map((table) => getTableName(table));
    const result = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const present = new Set(result.rows.map((row) => row.table_name));
    assert.deepEqual(tables.filter((name) => !present.has(name)), [], "Local schema is incomplete. Run npm run local:db:push.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query("INSERT INTO organizations (name, code) VALUES ($1, $2) RETURNING id", ["Synthetic local check", `check-${randomUUID().slice(0, 8)}`]);
      assert.match(inserted.rows[0].id, /^[0-9a-f-]{36}$/);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    console.log(`Database OK: ${tables.length} schema tables, UUID defaults, and rolled-back write transaction.`);
  } finally {
    await pool.end();
  }
  await checkLocalStorage();
}
