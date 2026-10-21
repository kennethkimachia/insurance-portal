import test from "node:test";
import assert from "node:assert/strict";
import { isPrototypePreviewEnabled } from "../lib/prototype-mode";
import { demoWorkspace, demoReport } from "../lib/prototype-fixtures";
import {
  motorClaimSchema,
  burglaryClaimSchema,
} from "../lib/schemas/claim-forms";
test("synthetic preview is opt-in and cannot be enabled in production", () => {
  assert.equal(
    isPrototypePreviewEnabled({
      NODE_ENV: "production",
      PORTAL_DEMO_ENABLED: "true",
    }),
    false,
  );
  assert.equal(isPrototypePreviewEnabled({ NODE_ENV: "development" }), false);
  assert.equal(
    isPrototypePreviewEnabled({
      NODE_ENV: "development",
      PORTAL_DEMO_ENABLED: "true",
    }),
    true,
  );
  assert.equal(
    isPrototypePreviewEnabled({ PORTAL_DEMO_ENABLED: "true" }),
    false,
  );
});
test("repeatable Motor and Burglary fixtures are valid first reports without police evidence", () => {
  assert.equal(motorClaimSchema.safeParse(demoReport("motor")).success, true);
  assert.equal(
    burglaryClaimSchema.safeParse(demoReport("burglary")).success,
    true,
  );
});
test("policyholder preview hides internal assessment and notes", () => {
  const user = demoWorkspace("user");
  assert.equal(user.claim.assessmentSummary, null);
  assert.equal(user.notes.length, 0);
  assert.equal(demoWorkspace("agent").notes[0].visibility, "internal");
});
