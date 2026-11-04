import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { demoWorkspace } from "../lib/prototype-fixtures";

const requireModule = createRequire(__filename);

test("export endpoint returns private ZIP bytes and reauthorizes every original; denied claims never read storage", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  function replace(path: string, exports: unknown) {
    const id = requireModule.resolve(path);
    originals.set(id, requireModule.cache[id]);
    const stub = new Module(id); stub.exports = exports; stub.loaded = true;
    requireModule.cache[id] = stub;
  }
  const routeId = requireModule.resolve("../app/api/claims/[claimId]/export/route");
  originals.set(routeId, requireModule.cache[routeId]);
  const data = demoWorkspace("agent");
  const bytes = new TextEncoder().encode("synthetic original evidence");
  data.documents[0].size = bytes.length;
  data.claim.claimNumber = 'CLAIM"\r\n東京';
  let signedIn = true, allowed = true, attachmentAllowed = true;
  let reads = 0, attachmentChecks = 0;
  try {
    replace("../lib/session", { requireSession: async () => {
      if (!signedIn) throw new Error("Not authenticated");
      return { id: "agent", role: "agent", emailVerified: true };
    } });
    replace("../app/actions/user/my-claims", { getClaimWorkspace: async (claimId: string) => {
      assert.equal(claimId, data.claim.id);
      if (!allowed) throw new Error("Claim not found or access denied");
      return data;
    } });
    replace("../lib/claim-attachment-access", { getAuthorizedClaimAttachment: async (session: { id: string }, claimId: string, documentId: string) => {
      attachmentChecks++;
      assert.equal(session.id, "agent"); assert.equal(claimId, data.claim.id); assert.equal(documentId, data.documents[0].id);
      if (!attachmentAllowed) throw new Error("Attachment not found or access denied");
      return { storageKey: "private-storage-key", sizeBytes: bytes.length, contentSha256: createHash("sha256").update(bytes).digest("hex") };
    } });
    replace("../lib/storage", { streamClaimFile: async function* (key: string, signal: AbortSignal) {
      assert.equal(key, "private-storage-key"); assert.equal(signal.aborted, false);
      reads++;
      yield bytes;
    } });
    delete requireModule.cache[routeId];
    const { GET } = requireModule(routeId) as typeof import("../app/api/claims/[claimId]/export/route");
    const request = () => GET(new Request(`https://portal.example.test/api/claims/${data.claim.id}/export`), { params: Promise.resolve({ claimId: data.claim.id }) });
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/zip");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.doesNotMatch(response.headers.get("content-disposition")!, /[\r\n]/);
    assert.match(response.headers.get("content-disposition")!, /filename\*=UTF-8''/);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    assert.equal(attachmentChecks, 1); assert.equal(reads, 1);
    assert.doesNotMatch(strFromU8(archive["report.html"]), /private-storage-key/);
    assert.deepEqual(Object.values(archive).at(-1), bytes);
    allowed = false;
    assert.equal((await request()).status, 404);
    assert.equal(reads, 1);
    allowed = true; signedIn = false;
    assert.equal((await request()).status, 404);
    assert.equal(reads, 1);
    signedIn = true; attachmentAllowed = false;
    await assert.rejects((await request()).arrayBuffer(), /access denied/);
    assert.equal(reads, 1);
    attachmentAllowed = true;
    data.documents[0].size = 0xffffffff;
    assert.equal((await request()).status, 413);
    assert.equal(reads, 1);
  } finally {
    for (const [id, original] of originals) {
      if (original) requireModule.cache[id] = original; else delete requireModule.cache[id];
    }
  }
});
