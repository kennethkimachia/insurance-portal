import test from "node:test";
import assert from "node:assert/strict";
import { canAccessClaim } from "../lib/claim-access-policy";
import { hasPermission, permissions, type Role } from "../lib/permissions";
import {
  validateStatusTransition,
  validateClaimReadiness,
} from "../lib/claim-workflow";

const claim = {
  policyholderId: "owner",
  assignedAgentId: "assigned",
  status: "under_review",
};

test("assignment and waiting-for-information stages require their dedicated operations", () => {
  assert.ok(validateStatusTransition("pending", "assigned", "head_agent"));
  assert.ok(
    validateStatusTransition("under_review", "awaiting_information", "agent"),
  );
  assert.ok(
    validateStatusTransition("awaiting_information", "under_review", "agent"),
  );
});
test("a policyholder cannot read, upload, or comment on another policyholder's claim", () => {
  for (const purpose of ["read", "upload", "comment"] as const) {
    assert.equal(canAccessClaim("user", "other", claim, true, purpose), false);
    assert.equal(canAccessClaim("user", "owner", claim, false, purpose), true);
  }
  assert.equal(canAccessClaim("user", "owner", claim, true, "manage"), false);
});
test("agent access requires both organization membership and assignment", () => {
  assert.equal(canAccessClaim("agent", "assigned", claim, false), false);
  assert.equal(canAccessClaim("agent", "other", claim, true), false);
  assert.equal(
    canAccessClaim("agent", "assigned", claim, true, "manage"),
    true,
  );
  assert.equal(canAccessClaim("head_agent", "manager", claim, false), false);
  assert.equal(canAccessClaim("head_agent", "manager", claim, true), true);
  assert.equal(canAccessClaim("admin", "admin", claim, false), true);
});
test("staff membership removal blocks every claim operation even when assignment remains", () => {
  for (const role of ["agent", "head_agent"] as const) {
    for (const purpose of ["read", "manage", "upload", "comment"] as const) {
      assert.equal(canAccessClaim(role, "assigned", claim, true, purpose), true);
      assert.equal(canAccessClaim(role, "assigned", claim, false, purpose), false);
    }
  }
});
test("only administrators can assign organizations, remove memberships, or invite staff", () => {
  for (const role of ["admin", "head_agent", "agent", "user"] satisfies Role[]) {
    for (const permission of [
      permissions.AGENT_WRITE,
      permissions.AGENT_DELETE,
      permissions.USER_INVITE,
      permissions.ORGANIZATION_WRITE,
      permissions.ORGANIZATION_DELETE,
    ]) assert.equal(hasPermission(role, permission), role === "admin");
  }
});
test("drafts remain private to their owner and platform administrator", () => {
  assert.equal(
    canAccessClaim(
      "head_agent",
      "manager",
      { ...claim, status: "draft" },
      true,
    ),
    false,
  );
  assert.equal(
    canAccessClaim("agent", "assigned", { ...claim, status: "draft" }, true),
    false,
  );
  assert.equal(
    canAccessClaim(
      "agent",
      "creator",
      { ...claim, status: "draft", createdBy: "creator" },
      true,
    ),
    true,
  );
  assert.equal(
    canAccessClaim(
      "agent",
      "creator",
      { ...claim, status: "draft", createdBy: "creator" },
      false,
    ),
    false,
  );
  assert.equal(
    canAccessClaim(
      "agent",
      "creator",
      { ...claim, status: "draft", createdBy: "creator" },
      true,
      "manage",
    ),
    false,
  );
});
test("outcomes require a manager, an assessment, and an explanation", () => {
  assert.ok(
    validateStatusTransition(
      "assessment_complete",
      "approved",
      "agent",
      "Reviewed evidence",
    ),
  );
  assert.ok(
    validateStatusTransition(
      "assigned",
      "approved",
      "head_agent",
      "Reviewed evidence",
    ),
  );
  assert.ok(
    validateStatusTransition(
      "assessment_complete",
      "rejected",
      "head_agent",
      "",
    ),
  );
  assert.equal(
    validateStatusTransition(
      "assessment_complete",
      "approved",
      "head_agent",
      "Reviewed supporting evidence",
    ),
    null,
  );
});
test("closed claims have explicit reopen rules and settlements are terminal", () => {
  assert.ok(
    validateStatusTransition("rejected", "under_review", "head_agent", ""),
  );
  assert.equal(
    validateStatusTransition(
      "rejected",
      "under_review",
      "head_agent",
      "New evidence received",
    ),
    null,
  );
  assert.ok(
    validateStatusTransition(
      "settled",
      "under_review",
      "head_agent",
      "New evidence received",
    ),
  );
  assert.ok(validateStatusTransition("under_review", "banana", "head_agent"));
});
test("assessment and payment cannot advance with missing assessment or outstanding evidence", () => {
  const ready = {
    assessmentSummary: "Reviewed incident and supporting information",
    openEvidenceRequests: 0,
    unreviewedDocuments: 0,
  };
  for (const stage of ["assessment_complete", "approved", "settled"] as const) {
    assert.equal(validateClaimReadiness(stage, ready), null);
    assert.ok(
      validateClaimReadiness(stage, { ...ready, assessmentSummary: "" }),
    );
    assert.ok(
      validateClaimReadiness(stage, { ...ready, openEvidenceRequests: 1 }),
    );
    assert.ok(
      validateClaimReadiness(stage, { ...ready, unreviewedDocuments: 1 }),
    );
  }
  assert.ok(
    validateClaimReadiness("rejected", { ...ready, assessmentSummary: null }),
  );
  assert.equal(
    validateClaimReadiness("rejected", { ...ready, openEvidenceRequests: 1 }),
    null,
  );
});
