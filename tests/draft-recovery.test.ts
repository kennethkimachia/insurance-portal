import test from "node:test";
import assert from "node:assert/strict";
import { ClaimDraftSaveQueue } from "../lib/claim-draft-client";
import { recoverEvidenceSelections } from "../lib/evidence-recovery";
import { actionError } from "../lib/action-errors";

test("a lost first-save response retries the same client-created draft ID", async () => {
  const ids: string[] = [];
  const queue = new ClaimDraftSaveQueue(
    async (_data: { description: string }, claimId) => {
      ids.push(claimId);
      if (ids.length === 1) throw new Error("Connection lost");
      return { success: true, claimId };
    },
  );
  assert.equal(
    (await queue.save({ description: "First report" })).success,
    false,
  );
  assert.equal(
    (await queue.save({ description: "First report" })).success,
    true,
  );
  assert.equal(new Set(ids).size, 1);
  assert.equal(ids[0], queue.claimId);
});

test("concurrent autosaves serialize changes and deduplicate confirmed identical saves", async () => {
  const calls: number[] = [];
  let active = 0;
  let maxActive = 0;
  const queue = new ClaimDraftSaveQueue(
    async (data: { revision: number }, claimId) => {
      active++;
      maxActive = Math.max(active, maxActive);
      await Promise.resolve();
      calls.push(data.revision);
      active--;
      return { success: true, claimId };
    },
  );
  await Promise.all([
    queue.save({ revision: 1 }),
    queue.save({ revision: 2 }),
    queue.save({ revision: 2 }),
  ]);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(maxActive, 1);
  queue.stop();
  await queue.save({ revision: 3 });
  assert.deepEqual(calls, [1, 2]);
});

test("resumed drafts keep their identifier and a mismatched server ID never counts as saved", async () => {
  const id = crypto.randomUUID();
  let calls = 0;
  const queue = new ClaimDraftSaveQueue(
    async (_data: string, claimId) => {
      calls++;
      return {
        success: true,
        claimId: calls === 1 ? crypto.randomUUID() : claimId,
      };
    },
    id,
    "Saved answers",
  );
  assert.equal((await queue.save("Revised answers")).success, false);
  assert.equal((await queue.save("Revised answers")).claimId, id);
  assert.equal(queue.claimId, id);
  assert.equal(calls, 2);
});

test("failed or interrupted files reselected after refresh recover their reservation and loss item", () => {
  const id = crypto.randomUUID();
  const lossItemId = crypto.randomUUID();
  const file = new File(["%PDF-1.7"], "receipt.pdf", {
    type: "application/pdf",
  });
  const selected = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    file,
    status: "selected" as const,
  };
  const record = {
    id: "attachment",
    category: "proof_of_ownership",
    name: file.name,
    size: file.size,
    clientUploadId: id,
    lossItemId,
    uploadState: "failed",
    reviewStatus: "pending",
  };
  for (const uploadState of ["failed", "uploading"]) {
    const recovered = recoverEvidenceSelections(
      { proof_of_ownership: [selected] },
      [{ ...record, uploadState }],
    ).proof_of_ownership[0];
    assert.equal(recovered.id, id);
    assert.equal(recovered.attachmentId, "attachment");
    assert.equal(recovered.lossItemId, lossItemId);
  }
  assert.equal(
    recoverEvidenceSelections({ proof_of_ownership: [selected] }, [
      { ...record, reviewStatus: "waived" },
    ]).proof_of_ownership[0].id,
    selected.id,
  );
  assert.equal(
    recoverEvidenceSelections({ proof_of_ownership: [selected] }, [
      { ...record, uploadState: "ready" },
    ]).proof_of_ownership[0].id,
    selected.id,
  );
  const reminders = [{ ...record, lossItemId: undefined, clientUploadId: id }];
  assert.equal(
    recoverEvidenceSelections({ proof_of_ownership: [selected] }, [], reminders)
      .proof_of_ownership[0].id,
    id,
  );
});

test("client errors never expose SQL, driver causes, or connection URLs", () => {
  assert.equal(
    actionError(new Error("Please refresh before updating")),
    "Please refresh before updating",
  );
  class DriverError extends Error {}
  for (const error of [
    new DriverError("secret query"),
    new Error("Failed query: SELECT private FROM user"),
    new Error("postgres://secret:password@host/db"),
    new Error("Connection failed", { cause: new Error("password") }),
    { message: "secret" },
  ])
    assert.equal(actionError(error, "Retry safely"), "Retry safely");
});
