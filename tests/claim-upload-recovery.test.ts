import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { claimAttachments, claimEvents } from "../db/schema";

const requireModule = createRequire(__filename);

test("interrupted upload recovery verifies stored identity, fences stale writes, and retains claim access", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  function replace(path: string, exports: unknown) {
    const id = requireModule.resolve(path); originals.set(id, requireModule.cache[id]);
    const stub = new Module(id); stub.exports = exports; stub.loaded = true; requireModule.cache[id] = stub;
  }
  const actionId = requireModule.resolve("../app/actions/agent/recover-claim-upload");
  originals.set(actionId, requireModule.cache[actionId]);
  const claimId = crypto.randomUUID(), attachmentId = crypto.randomUUID(), organizationId = crypto.randomUUID();
  const original = { id: attachmentId, claimId, uploadState: "uploading", updatedAt: new Date(Date.now() - 600_000), contentSha256: "expected-digest", sizeBytes: 1234, storageKey: `${organizationId}/claims/${claimId}/original.pdf`, originalFilename: "original.pdf", category: "police_abstract" };
  let row = { ...original };
  let denied = false, mismatch = false, missing = false, race = false, closed = false;
  let heads = 0, writes = 0, events = 0;
  const dialect = new PgDialect();
  const database = {
    select: () => ({ from: () => ({ where: (condition: SQL) => {
      const params = dialect.sqlToQuery(condition).params;
      assert.deepEqual(params, [attachmentId, claimId]);
      return { limit: async () => [row] };
    } }) }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: (condition: SQL) => {
      if (table !== claimAttachments) return Promise.resolve();
      const query = dialect.sqlToQuery(condition);
      assert.match(query.sql, /date_trunc\('milliseconds'/);
      assert.equal(query.params.at(-1), original.updatedAt.toISOString());
      return { returning: async () => {
        if (race) return [];
        writes++; row = { ...row, ...values }; return [row];
      } };
    } }) }),
    insert: (table: unknown) => ({ values: async () => { assert.equal(table, claimEvents); events++; } }),
  };
  try {
    replace("../db", { db: { ...database, transaction: async (run: (tx: typeof database) => Promise<unknown>) => run(database) } });
    replace("../lib/session", { requireSession: async () => ({ id: "staff", role: "agent" }) });
    replace("../lib/claim-access", {
      requireClaimAccess: async (_session: unknown, id: string, purpose: string) => {
        assert.equal(id, claimId); assert.equal(purpose, "upload");
        if (denied) throw new Error("Claim not found or access denied");
        return { organizationId, status: "assigned" };
      },
      lockClaimForMutation: async () => ({ status: closed ? "settled" : "assigned" }),
    });
    replace("../lib/storage", { getClaimStorage: () => ({ bucket: "private-bucket", s3: { send: async () => {
      heads++; if (missing) throw new Error("Missing object");
      return { ContentLength: 1234, Metadata: { sha256: mismatch ? "different-file" : "expected-digest" } };
    } } }) });
    replace("next/cache", { revalidatePath: () => {} });
    delete requireModule.cache[actionId];
    const { recoverClaimUpload } = requireModule(actionId) as typeof import("../app/actions/agent/recover-claim-upload");

    denied = true;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(heads, 0);
    denied = false;
    row.updatedAt = new Date();
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(heads, 0);
    row = { ...original };
    mismatch = true;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(writes, 0);
    mismatch = false; missing = true;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(writes, 0);
    missing = false; closed = true;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(writes, 0);
    closed = false; race = true;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, false);
    assert.equal(events, 0);
    race = false;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, true);
    assert.equal(writes, 1); assert.equal(events, 1); assert.equal(row.uploadState, "ready");
    const before = heads;
    assert.equal((await recoverClaimUpload(claimId, attachmentId)).success, true);
    assert.equal(heads, before); assert.equal(events, 1);
  } finally {
    for (const [id, original] of originals) {
      if (original) requireModule.cache[id] = original; else delete requireModule.cache[id];
    }
  }
});
