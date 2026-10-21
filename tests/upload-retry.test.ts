import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadClaimDocuments,
  type UploadProgress,
} from "../lib/upload-claim-documents";
import type { DocumentUploads } from "../components/claims/document-uploader";

test("per-file progress and retries preserve identifiers while completed files are skipped", async () => {
  const original = globalThis.XMLHttpRequest;
  const requests: Array<{
    claimId: string;
    fileId: string;
    category: string;
    lossItemId: string | null;
  }> = [];
  const outcomes = ["success", "connection", "success", "success"];
  let active = 0;
  let maxActive = 0;
  class FakeRequest {
    upload: {
      onprogress?: (event: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void;
    } = {};
    status = 200;
    responseText = "";
    timeout = 0;
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    onabort?: () => void;
    open(method: string, url: string) {
      assert.equal(method, "POST");
      assert.equal(url, "/api/upload");
    }
    send(body: FormData) {
      const fileId = String(body.get("clientUploadId"));
      requests.push({
        claimId: String(body.get("claimId")),
        fileId,
        category: String(body.get("category")),
        lossItemId: body.get("lossItemId") as string | null,
      });
      const outcome = outcomes.shift();
      active++;
      maxActive = Math.max(active, maxActive);
      queueMicrotask(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        active--;
        if (outcome === "connection") this.onerror?.();
        else {
          this.responseText = JSON.stringify({
            success: true,
            attachmentId: `attachment-${fileId}`,
          });
          this.onload?.();
        }
      });
    }
  }
  globalThis.XMLHttpRequest = FakeRequest as unknown as typeof XMLHttpRequest;
  try {
    const claimId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const lossItemId = crypto.randomUUID();
    let uploads: DocumentUploads = {
      proof_of_ownership: ["one.pdf", "two.pdf", "three.pdf"].map((name) => {
        const file = new File(["%PDF-1.7"], name, { type: "application/pdf" });
        return {
          id: crypto.randomUUID(),
          name,
          size: file.size,
          type: file.type,
          file,
          lossItemId,
          status: "selected",
        };
      }),
    };
    const retryId = uploads.proof_of_ownership[1].id;
    const progress: UploadProgress[] = [];
    const onProgress = (event: UploadProgress) => {
      progress.push(event);
      uploads = Object.fromEntries(
        Object.entries(uploads).map(([category, files]) => [
          category,
          files.map((file) =>
            file.id === event.fileId ? { ...file, ...event } : file,
          ),
        ]),
      );
    };
    const first = await uploadClaimDocuments(claimId, organizationId, uploads, {
      onProgress,
    });
    assert.equal(first.uploaded, 2);
    assert.equal(first.failed, 1);
    assert.equal(uploads.proof_of_ownership[1].status, "failed");
    assert.match(uploads.proof_of_ownership[1].error!, /Connection lost/);
    const retry = await uploadClaimDocuments(claimId, organizationId, uploads, {
      fileIds: [retryId],
      onProgress,
    });
    assert.equal(retry.uploaded, 1);
    assert.equal(retry.failed, 0);
    assert.equal(requests.length, 4);
    assert.equal(requests[1].fileId, requests[3].fileId);
    assert.ok(
      requests.every(
        (request) =>
          request.claimId === claimId &&
          request.lossItemId === lossItemId &&
          request.category === "proof_of_ownership",
      ),
    );
    assert.ok(
      progress.some(
        (event) =>
          event.status === "uploading" &&
          event.progress > 0 &&
          event.progress < 100,
      ),
    );
    assert.ok(
      uploads.proof_of_ownership.every(
        (file) => file.status === "uploaded" && file.progress === 100,
      ),
    );
    assert.equal(maxActive, 1);
  } finally {
    globalThis.XMLHttpRequest = original;
  }
});

test("invalid files fail locally without sending a request or losing their retry state", async () => {
  const file = new File(["executable"], "malware.exe", {
    type: "application/octet-stream",
  });
  const updates: UploadProgress[] = [];
  const result = await uploadClaimDocuments(
    crypto.randomUUID(),
    crypto.randomUUID(),
    {
      other: [
        {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          file,
        },
      ],
    },
    { onProgress: (update) => updates.push(update) },
  );
  assert.equal(result.failed, 1);
  assert.equal(result.uploaded, 0);
  assert.equal(updates[0].status, "failed");
  assert.match(updates[0].error!, /not an accepted file/);
});
