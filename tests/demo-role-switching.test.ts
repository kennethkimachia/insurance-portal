import assert from "node:assert/strict";
import test from "node:test";
import {
  canSwitchDemoRoles, DEMO_ROLES, isDemoAgent, resolveDemoRole,
} from "../lib/demo-role-policy";
import { canAccessClaim } from "../lib/claim-access-policy";
import { hasPermission, permissions, type Role } from "../lib/permissions";

const account = { role: "admin" as Role, clerkUserId: "user_presenter", clerkSessionId: "session_presenter" };
const cookie = (role: string, overrides = {}) => JSON.stringify({ ...account, role, ...overrides });

test("staff can showcase every role with no deployment or environment configuration", () => {
  for (const baseRole of ["agent", "head_agent", "admin"] as const) {
    assert.equal(canSwitchDemoRoles(baseRole), true);
    for (const { role } of DEMO_ROLES) {
      assert.equal(resolveDemoRole({ ...account, role: baseRole }, cookie(role)), role);
    }
  }
  assert.equal(account.role, "admin");
});

test("switching back and exiting demo do not permanently change the account role", () => {
  for (const selected of ["user", "agent", "head_agent", "admin", "user"]) {
    assert.equal(resolveDemoRole(account, cookie(selected)), selected);
  }
  const override = resolveDemoRole(account, undefined);
  assert.equal(override, null);
  assert.equal(override ?? account.role, "admin");
});

test("policyholder and unassigned accounts cannot enable role switching with a forged cookie", () => {
  for (const role of ["user", null] as const) {
    assert.equal(canSwitchDemoRoles(role), false);
    assert.equal(resolveDemoRole({ ...account, role }, cookie("admin")), null);
  }
});

test("demo role state cannot carry over to another account or a new sign-in", () => {
  assert.equal(resolveDemoRole({ ...account, clerkUserId: "user_other" }, cookie("admin")), null);
  assert.equal(resolveDemoRole({ ...account, clerkSessionId: "session_new" }, cookie("admin")), null);
  assert.equal(resolveDemoRole(account, cookie("admin", { clerkSessionId: undefined })), null);
});

test("malformed and unsupported demo role states are ignored", () => {
  for (const value of [undefined, "", "invalid", "null", "[]", "{}", cookie("owner"), cookie("ADMIN")]) {
    assert.equal(resolveDemoRole(account, value), null);
  }
});

test("the selected policyholder role keeps normal ownership and permission restrictions", () => {
  const role = resolveDemoRole(account, cookie("user"))!;
  const claim = { policyholderId: "presenter", createdBy: "presenter", assignedAgentId: "agent", status: "pending" };
  assert.equal(canAccessClaim(role, "presenter", claim, false), true);
  assert.equal(canAccessClaim(role, "someone_else", claim, true), false);
  assert.equal(canAccessClaim(role, "presenter", claim, true, "manage"), false);
  assert.equal(hasPermission(role, permissions.CLAIM_ASSIGN), false);
  assert.equal(hasPermission(role, permissions.USER_MANAGE), false);
});

test("only the active presenter can act as their own demo agent", () => {
  assert.equal(isDemoAgent({ id: "presenter", demo: { active: true } }, "presenter"), true);
  assert.equal(isDemoAgent({ id: "presenter", demo: { active: true } }, "another_actor"), false);
  assert.equal(isDemoAgent({ id: "presenter", demo: { active: false } }, "presenter"), false);
  assert.equal(isDemoAgent({ id: "presenter" }, "presenter"), false);
});
