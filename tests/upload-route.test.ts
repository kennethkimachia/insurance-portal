import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { claimAttachments, claimEvents, claims } from "../db/schema";

const claimId = crypto.randomUUID();
const organizationId = crypto.randomUUID();
const actorId = crypto.randomUUID();
const dialect = new PgDialect();
const requireModule = createRequire(__filename);
type Row = Record<string, unknown> & {
  id: string;
  uploadState: string;
  updatedAt: Date;
};

// Model PostgreSQL's microsecond storage and node-postgres's millisecond Dates.
// Both INSERT RETURNING and SELECT lose the submillisecond part on the way out.
function postgresMicros(timestamp: string) {
  const fraction = /\.(\d+)/.exec(timestamp)?.[1] ?? "";
  return BigInt(Date.parse(timestamp)) * BigInt(1000) +
    BigInt(fraction.padEnd(6, "0").slice(3, 6));
}

function uploadDatabase() {
  let row: Row | undefined;
  let storedTimestamp = "";
  let events = 0;
  const returnedRow = () => row && { ...row, updatedAt: new Date(storedTimestamp) };
  const database = {
    select: () => ({
      from: () => ({
        where: () => {
          const rows = row ? [returnedRow()] : [];
          return Object.assign(Promise.resolve([{ count: row ? 1 : 0, size: 0 }]), {
            limit: async () => rows,
          });
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table === claimEvents) {
          events++;
          return Promise.resolve();
        }
        assert.equal(table, claimAttachments);
        // A database DEFAULT now() is intentionally finer than a JS Date.
        storedTimestamp = values.updatedAt instanceof Date
          ? values.updatedAt.toISOString()
          : "2026-11-04T12:00:00.123456Z";
        row = {
          ...values,
          id: crypto.randomUUID(),
          lossItemId: values.lossItemId ?? null,
          uploadState: String(values.uploadState),
          updatedAt: new Date(storedTimestamp),
        };
        return { returning: async () => [returnedRow()] };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: SQL) => {
          if (table === claims) return Promise.resolve();
          assert.equal(table, claimAttachments);
          const query = dialect.sqlToQuery(condition);
          const [id, state, timestamp] = query.params;
          const fenced = query.sql.includes('"updated_at" =');
          const matches = row?.id === id && (!fenced || (
            row?.uploadState === state &&
            postgresMicros(storedTimestamp) === postgresMicros(String(timestamp))
          ));
          if (matches) {
            row = { ...row!, ...values };
            if (values.updatedAt instanceof Date)
              storedTimestamp = values.updatedAt.toISOString();
          }
          const rows = matches ? [returnedRow()] : [];
          return Object.assign(Promise.resolve(rows), { returning: async () => rows });
        },
      }),
    }),
  };
  return {
    database: {
      ...database,
      transaction: async <T>(run: (tx: typeof database) => Promise<T>) => run(database),
    },
    row: () => returnedRow(),
    events: () => events,
  };
}

function uploadRequest(file: File, clientUploadId: string) {
  const body = new FormData();
  body.append("claimId", claimId);
  body.append("clientUploadId", clientUploadId);
  body.append("category", "other");
  body.append("file", file);
  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
    body,
  });
}

test("upload route finalizes new PDF/image reservations and releases failed attempts for same-file retry", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  function replaceModule(path: string, exports: unknown) {
    const id = requireModule.resolve(path);
    originals.set(id, requireModule.cache[id]);
    const stub = new Module(id);
    stub.exports = exports;
    stub.loaded = true;
    requireModule.cache[id] = stub;
  }

  let fixture = uploadDatabase();
  let failStorage = false;
  let storageCalls = 0;
  const claim = { id: claimId, organizationId, policyType: "motor", status: "submitted" };
  const routeId = requireModule.resolve("../app/api/upload/route");
  originals.set(routeId, requireModule.cache[routeId]);
  try {
    replaceModule("../db", {
      db: new Proxy({}, { get: (_target, key) => fixture.database[key as keyof typeof fixture.database] }),
    });
    replaceModule("../lib/session", {
      getSessionUser: async () => ({ id: actorId, role: "user", emailVerified: true }),
    });
    replaceModule("../lib/claim-access", {
      requireClaimAccess: async () => claim,
      lockClaimForMutation: async () => claim,
    });
    replaceModule("../lib/storage", {
      getClaimStorage: () => ({ s3: {}, bucket: "synthetic-bucket" }),
      buildClaimFileKey: () => "synthetic-key",
    });
    replaceModule("../lib/storage-operations", {
      putVerifiedEvidence: async () => {
        storageCalls++;
        if (failStorage) throw new Error("Storage unavailable. Retry the same file.");
      },
    });
    delete requireModule.cache[routeId];
    const { POST } = requireModule("../app/api/upload/route") as typeof import("../app/api/upload/route");

    for (const file of [
      new File(["%PDF-1.7 synthetic evidence"], "report.pdf", { type: "application/pdf" }),
      new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])], "scene.png", { type: "image/png" }),
    ]) {
      fixture = uploadDatabase();
      const clientUploadId = crypto.randomUUID();
      const response = await POST(uploadRequest(file, clientUploadId));
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      assert.equal((await response.json()).attachmentId, fixture.row()?.id);
      assert.equal(fixture.row()?.uploadState, "ready");
      assert.equal(fixture.events(), 1);

      // A lost success response can be retried without another object or event.
      const before = storageCalls;
      const retry = await POST(uploadRequest(file, clientUploadId));
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).alreadyUploaded, true);
      assert.equal(storageCalls, before);
      assert.equal(fixture.events(), 1);
    }

    fixture = uploadDatabase();
    const file = new File(["%PDF-1.7 synthetic evidence"], "retry.pdf", { type: "application/pdf" });
    const clientUploadId = crypto.randomUUID();
    failStorage = true;
    const failed = await POST(uploadRequest(file, clientUploadId));
    assert.equal(failed.status, 400);
    assert.equal(fixture.row()?.uploadState, "failed");
    assert.equal(fixture.events(), 0);
    const attachmentId = fixture.row()?.id;
    failStorage = false;
    const retry = await POST(uploadRequest(file, clientUploadId));
    assert.equal(retry.status, 200, JSON.stringify(await retry.clone().json()));
    assert.equal((await retry.json()).attachmentId, attachmentId);
    assert.equal(fixture.row()?.uploadState, "ready");
    assert.equal(fixture.events(), 1);
  } finally {
    for (const [id, original] of originals) {
      if (original) requireModule.cache[id] = original;
      else delete requireModule.cache[id];
    }
  }
});
