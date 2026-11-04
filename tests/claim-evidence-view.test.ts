import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { NextRequest } from "next/server";

const requireModule = createRequire(__filename);

test("private preview route checks claim access, rejects active types, and retains forced downloads", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  function replace(path: string, exports: unknown) {
    const id = requireModule.resolve(path);
    originals.set(id, requireModule.cache[id]);
    const stub = new Module(id); stub.exports = exports; stub.loaded = true;
    requireModule.cache[id] = stub;
  }
  const routeId = requireModule.resolve("../app/api/claims/[claimId]/attachments/[attachmentId]/route");
  originals.set(routeId, requireModule.cache[routeId]);
  let signed = 0;
  let authenticated = true;
  let denied = false;
  let type = "application/pdf";
  let responseOptions: { contentType: string; contentDisposition: string } | undefined;
  class AccessError extends Error { status = 404; }
  try {
    replace("../lib/session", { getSessionUser: async () => authenticated ? { role: "agent", emailVerified: true } : null });
    replace("../lib/claim-attachment-access", {
      ClaimAttachmentAccessError: AccessError,
      getAuthorizedClaimAttachment: async (_session: unknown, claimId: string, attachmentId: string) => {
        assert.equal(claimId, "authorized-claim"); assert.equal(attachmentId, "authorized-document");
        if (denied) throw new AccessError("Attachment not found or access denied");
        return { storageKey: "private-object", originalFilename: "police report.pdf", contentType: type };
      },
    });
    replace("../lib/storage", { getFileUrl: async (_key: string, expires: number, options: typeof responseOptions) => {
      signed++; assert.equal(expires, 300); responseOptions = options;
      return "https://private-storage.example.test/document?signature=synthetic";
    } });
    delete requireModule.cache[routeId];
    const { GET } = requireModule(routeId) as typeof import("../app/api/claims/[claimId]/attachments/[attachmentId]/route");
    const context = { params: Promise.resolve({ claimId: "authorized-claim", attachmentId: "authorized-document" }) };
    const request = (preview = true) => new NextRequest(`https://portal.example.test/api/claims/authorized-claim/attachments/authorized-document${preview ? "?preview=1" : ""}`);
    const preview = await GET(request(), context);
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).contentType, "application/pdf");
    assert.match(responseOptions!.contentDisposition, /^inline;/);
    assert.equal(responseOptions!.contentType, "application/pdf");
    assert.equal(preview.headers.get("cache-control"), "private, no-store");
    const download = await GET(request(false), context);
    assert.equal(download.status, 307);
    assert.match(responseOptions!.contentDisposition, /^attachment;/);
    assert.equal(responseOptions!.contentType, "application/octet-stream");
    const before = signed;
    for (type of ["text/html", "image/svg+xml", "text/csv"]) assert.equal((await GET(request(), context)).status, 415);
    assert.equal(signed, before);
    denied = true;
    assert.equal((await GET(request(), context)).status, 404);
    assert.equal(signed, before);
    authenticated = false;
    assert.equal((await GET(request(), context)).status, 401);
    assert.equal(signed, before);
  } finally {
    for (const [id, original] of originals) {
      if (original) requireModule.cache[id] = original; else delete requireModule.cache[id];
    }
  }
});
