import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  makeClaimReference,
  claimNextAction,
  CLOSED_CLAIM_STATUSES,
} from "../lib/claim-record-policy";

test("references survive retries and preserve the UUID's collision space", () => {
  const id = randomUUID();
  assert.equal(makeClaimReference("TEST", id), makeClaimReference("TEST", id));
  const refs = new Set(
    Array.from({ length: 10_000 }, () =>
      makeClaimReference("TEST", randomUUID()),
    ),
  );
  assert.equal(refs.size, 10_000);
  assert.ok(makeClaimReference("ORG-CODE-WITH-MANY-CHARS", id).length <= 50);
});
test("next actions distinguish drafts, received reports, requests and recorded outcomes", () => {
  assert.match(claimNextAction("draft", 0), /Resume/);
  assert.match(claimNextAction("pending", 0), /received/);
  assert.match(
    claimNextAction("awaiting_information", 2),
    /2 information requests/,
  );
  assert.match(claimNextAction("approved", 0), /not yet/);
  assert.match(claimNextAction("rejected", 2), /recorded outcome/);
  assert.match(claimNextAction("withdrawn", 1), /recorded outcome/);
  assert.equal(CLOSED_CLAIM_STATUSES.has("approved"), false);
  assert.equal(CLOSED_CLAIM_STATUSES.has("withdrawn"), true);
});
