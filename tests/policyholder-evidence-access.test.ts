import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { canAccessClaim } from "../lib/claim-access-policy";

const requireModule = createRequire(__filename);

test("policyholders can preview and download their claim's received documents before inspection without crossing claim boundaries", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  function replace(path: string, exports: unknown) {
    const id = requireModule.resolve(path); originals.set(id, requireModule.cache[id]);
    const stub = new Module(id); stub.exports = exports; stub.loaded = true; requireModule.cache[id] = stub;
  }
  for (const path of ["../lib/claim-attachment-access", "../app/api/claims/[claimId]/attachments/[attachmentId]/route"]) {
    const id = requireModule.resolve(path); originals.set(id, requireModule.cache[id]); delete requireModule.cache[id];
  }
  const organizationId = crypto.randomUUID(), ownClaim = crypto.randomUUID(), otherClaim = crypto.randomUUID();
  const attachmentId = crypto.randomUUID(), otherAttachment = crypto.randomUUID();
  const original = { id: attachmentId, claimId: ownClaim, storageKey: `${organizationId}/claims/${ownClaim}/document.webp`, contentType: "image/webp", originalFilename: "registration.webp", uploadState: "ready", scanState: "pending", reviewStatus: "pending", uploadedBy: "owner" };
  let row = { ...original };
  let actorId = "owner", verified = true;
  let role: "user" | "agent" = "user";
  let signed = 0;
  const dialect = new PgDialect();
  try {
    replace("../db", { db: { select: () => ({ from: () => ({ where: (condition: SQL) => ({ limit: async () => {
      const query = dialect.sqlToQuery(condition);
      return query.params[0] === row.id && query.params[1] === row.claimId ? [row] : [];
    } }) }) }) } });
    replace("../lib/session", { getSessionUser: async () => ({ id: actorId, role, emailVerified: verified }) });
    replace("../lib/claim-access", { requireClaimAccess: async (session: { id: string; role: "user" | "agent" }, claimId: string) => {
      const claim = { policyholderId: claimId === ownClaim ? "owner" : "other-owner", assignedAgentId: "staff", organizationId };
      if (!canAccessClaim(session.role, session.id, claim, true)) throw new Error("Claim not found or access denied");
      return claim;
    } });
    replace("../lib/storage", { getFileUrl: async (key: string) => { signed++; assert.equal(key, original.storageKey); return "https://storage.example.test/private-object?synthetic-signature"; } });
    const { GET } = requireModule("../app/api/claims/[claimId]/attachments/[attachmentId]/route") as typeof import("../app/api/claims/[claimId]/attachments/[attachmentId]/route");
    const request = (claimId = ownClaim, fileId = attachmentId, preview = true) => GET(
      new NextRequest(`https://portal.example.test/api/claims/${claimId}/attachments/${fileId}${preview ? "?preview=1" : ""}`),
      { params: Promise.resolve({ claimId, attachmentId: fileId }) },
    );
    const preview = await request();
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).contentType, "image/webp");
    assert.equal(preview.headers.get("cache-control"), "private, no-store");
    assert.equal((await request(ownClaim, attachmentId, false)).status, 307);
    assert.equal(row.reviewStatus, "pending"); assert.equal(row.scanState, "pending");
    // A staff member may have supplied evidence on behalf of the same claimant.
    row.uploadedBy = "staff";
    assert.equal((await request()).status, 200);
    const before = signed;
    assert.equal((await request(otherClaim)).status, 404);
    assert.equal((await request(ownClaim, otherAttachment)).status, 404);
    actorId = "other-owner";
    assert.equal((await request()).status, 404);
    actorId = "owner";
    verified = false;
    assert.equal((await request()).status, 401);
    verified = true;
    for (const scanState of ["rejected", "quarantined", "unknown"]) {
      row = { ...original, scanState };
      assert.equal((await request()).status, 403);
    }
    for (const uploadState of ["uploading", "failed"]) {
      row = { ...original, uploadState };
      assert.equal((await request()).status, 403);
    }
    row = { ...original, storageKey: `${organizationId}/claims/${otherClaim}/document.webp` };
    assert.equal((await request()).status, 500);
    assert.equal(signed, before);
    row = { ...original };
    role = "agent"; actorId = "staff";
    assert.equal((await request()).status, 200);
    assert.equal(row.reviewStatus, "pending");
  } finally {
    for (const [id, original] of originals) { if (original) requireModule.cache[id] = original; else delete requireModule.cache[id]; }
  }
});
