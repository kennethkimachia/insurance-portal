import assert from "node:assert/strict";
import test from "node:test";
import {
  canBootstrapPortal, createPortalPolicyNumber, invitationConflict,
  invitationRegistrationPath, invitationResendAvailable, invitationState,
} from "../lib/invitation-policy";
import { policyholderOnboardingSchema } from "../lib/schemas/policyholder-onboarding";
import { portalInvitationRedirect, sendClerkInvitation, revokeClerkInvitation, type ClerkInvitationClient } from "../lib/clerk-invitation-policy";

const token = "a".repeat(64);
const now = new Date("2026-11-01T12:00:00Z");
const expiresAt = new Date("2026-11-08T12:00:00Z");
const holder = { purpose: "policyholder", role: "user" as const, organizationId: "insurer-a", enrollmentPolicyType: "motor" };
const staff = { purpose: "staff", role: "agent" as const, organizationId: "insurer-a" };
const record = {
  fullName: "Test Holder", email: "holder@example.test", policyType: "motor",
  organizationId: "39f09d04-ae45-4696-a0db-0cd3b490cdca",
};

function client() {
  const created: unknown[] = [];
  const revoked: string[] = [];
  const api: ClerkInvitationClient = {
    async createInvitation(input) { created.push(input); return { id: "inv_test" }; },
    async getInvitationList() { return { data: [{ id: "inv_test", status: "pending" }] }; },
    async revokeInvitation(id) { revoked.push(id); },
  };
  return { api, created, revoked };
}

test("prototype invitations need only a name, email, policy type, and organization", () => {
  for (const policyType of ["motor", "burglary"]) {
    const input = { ...record, policyType };
    assert.deepEqual(policyholderOnboardingSchema.parse(input), input);
  }
  assert.deepEqual(
    policyholderOnboardingSchema.parse({ ...record, fullName: "  Test Holder  ", email: "  holder@example.test  " }),
    record,
  );
});

test("prototype invitations still validate the invited identity and policy type", () => {
  for (const override of [
    { fullName: "" }, { fullName: " " }, { fullName: "x" }, { fullName: "x".repeat(151) },
    { email: "invalid" }, { email: "" }, { policyType: "home" }, { policyType: "" },
    { organizationId: "" }, { organizationId: "not-an-organization" },
  ]) assert.equal(policyholderOnboardingSchema.safeParse({ ...record, ...override }).success, false);
});

test("prototype invitation input strips extra policy details and staff roles", () => {
  assert.deepEqual(policyholderOnboardingSchema.parse({
    ...record, role: "admin", source: "manual", insurerReference: "INS-123",
    coverageStart: "invalid", coverageEnd: "", insuredAsset: "", coverageSummary: "",
    phone: "", policyConfirmed: false,
  }), record);
});

test("policy references distinguish manual and demo records and contain no personal identifiers", () => {
  for (const source of ["manual", "demo"] as const) for (const type of ["motor", "burglary"] as const) {
    const first = createPortalPolicyNumber(source, type);
    assert.match(first, new RegExp(`^${source === "manual" ? "MAN" : "DEMO"}-${type === "motor" ? "MOT" : "BRG"}-[A-F0-9]{24}$`));
    assert.notEqual(first, createPortalPolicyNumber(source, type));
  }
});

test("pending invitations cannot reserve incompatible roles or policyholder organizations", () => {
  assert.equal(invitationConflict(holder, holder), true);
  assert.equal(invitationConflict(holder, { ...holder, enrollmentPolicyType: "burglary" }), false);
  assert.equal(invitationConflict(holder, { ...holder, organizationId: "insurer-b" }), true);
  assert.equal(invitationConflict(holder, staff), true);
  assert.equal(invitationConflict(staff, { ...staff, role: "head_agent" }), true);
  assert.equal(invitationConflict(staff, { ...staff, organizationId: "insurer-b" }), false);
  assert.equal(invitationConflict(staff, staff), true);
});

test("only the configured verified bootstrap administrator bypasses invitations", () => {
  const identity = { clerkUserId: "user_bootstrap", role: "admin" as const, emailVerified: true };
  assert.equal(canBootstrapPortal(identity, "user_bootstrap"), true);
  assert.equal(canBootstrapPortal(identity), false);
  assert.equal(canBootstrapPortal(identity, "user_other"), false);
  assert.equal(canBootstrapPortal({ ...identity, role: "agent" }, "user_bootstrap"), false);
  assert.equal(canBootstrapPortal({ ...identity, emailVerified: false }, "user_bootstrap"), false);
});

test("invitation links require a trusted HTTPS origin; localhost is explicit", () => {
  assert.equal(portalInvitationRedirect("https://claims.example.test", token), `https://claims.example.test/invitations/${token}`);
  assert.equal(portalInvitationRedirect("http://localhost:3000", token), `http://localhost:3000/invitations/${token}`);
  for (const origin of [undefined, "", "http://claims.example.test", "https://user:password@claims.example.test", "https://claims.example.test/path", "https://claims.example.test?next=bad"]) {
    assert.throws(() => portalInvitationRedirect(origin, token));
  }
  assert.throws(() => portalInvitationRedirect("https://claims.example.test", "invalid"));
  assert.equal(invitationRegistrationPath(token), `/sign-up/activate/${token}`);
  assert.equal(invitationRegistrationPath("invalid"), null);
});

test("Clerk sends invitations for new or existing accounts without granting a portal role", async () => {
  const { api, created } = client();
  assert.deepEqual(await sendClerkInvitation(api, { id: "local_invitation", email: "holder@example.test", token, expiresAt, baseURL: "https://claims.example.test" }, now), { id: "inv_test" });
  assert.deepEqual(created, [{
    emailAddress: "holder@example.test", redirectUrl: `https://claims.example.test/invitations/${token}`,
    expiresInDays: 7, notify: true, ignoreExisting: true, publicMetadata: { portalInvitationId: "local_invitation" },
  }]);
  await assert.rejects(sendClerkInvitation(api, { id: "local_invitation", email: "holder@example.test", token, expiresAt: now, baseURL: "https://claims.example.test" }, now), /expired/);
  assert.equal(created.length, 1);
});

test("Clerk invitation revocation checks exact ID and only revokes pending tickets", async () => {
  const { api, revoked } = client();
  await revokeClerkInvitation(api, "inv_test");
  assert.deepEqual(revoked, ["inv_test"]);
  for (const status of ["accepted", "revoked", "expired"]) {
    api.getInvitationList = async () => ({ data: [{ id: "inv_test", status }] });
    await revokeClerkInvitation(api, "inv_test");
  }
  api.getInvitationList = async () => ({ data: [{ id: "another_invite", status: "pending" }] });
  await revokeClerkInvitation(api, "inv_test");
  await revokeClerkInvitation(api, null);
  assert.deepEqual(revoked, ["inv_test"]);
  api.getInvitationList = async () => { throw new Error("provider unavailable"); };
  await assert.rejects(revokeClerkInvitation(api, "inv_test"), /provider unavailable/);
});

test("resends enforce a one minute cooldown and unknown/revoked states fail closed", () => {
  assert.equal(invitationResendAvailable(new Date(now.getTime() - 59_999), now), false);
  assert.equal(invitationResendAvailable(new Date(now.getTime() - 60_000), now), true);
  assert.equal(invitationState({ status: "revoked", expiresAt }, now), "revoked");
  assert.equal(invitationState({ status: "unexpected", expiresAt }, now), "revoked");
});
