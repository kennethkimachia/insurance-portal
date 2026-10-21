import assert from "node:assert/strict";
import test from "node:test";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationAcceptanceError,
  invitationState,
  isInvitationToken,
  normalizeEmail,
  normalizedPhone,
} from "../lib/invitation-policy";
import {
  safeAuthContinuation,
  invitationContinuation,
} from "../lib/auth-navigation";

const now = new Date("2026-10-03T10:00:00.000Z");
const invitation = {
  email: "holder@example.test",
  role: "user" as const,
  purpose: "policyholder" as const,
  organizationId: "insurer-a",
  status: "pending",
  expiresAt: new Date("2026-10-10T10:00:00.000Z"),
  revokedAt: null,
};
const identity = {
  email: "holder@example.test",
  emailVerified: true,
  role: "user" as const,
  organizationId: null,
};

test("session recovery returns to a known claim or its original draft without external redirects", () => {
  const id = "39f09d04-ae45-4696-a0db-0cd3b490cdca";
  for (const value of [
    `/claims/${id}`,
    `/claims/${id}#documents`,
    `/claim-forms/motor?draft=${id}&policy=${id}`,
    "/claim-forms",
    "/notifications",
  ])
    assert.equal(safeAuthContinuation(value), value);
  for (const value of [
    "//evil.test/claim-forms",
    "/claim-forms?draft=bad",
    `/claim-forms?draft=${id}&draft=${id}`,
    "/claim-forms/motor?redirect=https://evil.test",
    "/claim-forms/home",
    "/claims/../sign-in",
    "/claim-forms\\evil",
    "/claims/%2f%2fevil.test",
  ])
    assert.equal(safeAuthContinuation(value), "/dashboard");
});

test("new and existing verified policyholders can accept their own organization's invitation", () => {
  assert.equal(invitationAcceptanceError(invitation, identity, now), null);
  assert.equal(
    invitationAcceptanceError(
      invitation,
      { ...identity, organizationId: "insurer-a" },
      now,
    ),
    null,
  );
  assert.equal(
    invitationAcceptanceError(
      invitation,
      { ...identity, email: "  HOLDER@example.test " },
      now,
    ),
    null,
  );
});

test("wrong email, unverified identity and suspended account cannot accept", () => {
  assert.match(
    invitationAcceptanceError(
      invitation,
      { ...identity, email: "someone@example.test" },
      now,
    )!,
    /invitation was sent/,
  );
  assert.match(
    invitationAcceptanceError(
      invitation,
      { ...identity, emailVerified: false },
      now,
    )!,
    /Verify your email/,
  );
  assert.match(
    invitationAcceptanceError(
      invitation,
      { ...identity, suspendedAt: now },
      now,
    )!,
    /suspended/,
  );
});

test("used, revoked and expired invitations reject acceptance, including exact expiry", () => {
  for (const invalid of [
    { ...invitation, status: "accepted" },
    { ...invitation, revokedAt: now },
    { ...invitation, expiresAt: now },
  ]) {
    assert.match(
      invitationAcceptanceError(invalid, identity, now)!,
      /no longer available/,
    );
  }
  assert.equal(
    invitationState({ ...invitation, expiresAt: now }, now),
    "expired",
  );
  assert.equal(
    invitationState({ ...invitation, revokedAt: now }, now),
    "revoked",
  );
  assert.equal(
    invitationState({ ...invitation, status: "accepted", expiresAt: now }, now),
    "accepted",
  );
});

test("policyholder invitations cannot promote staff or cross organization boundaries", () => {
  assert.match(
    invitationAcceptanceError(
      invitation,
      { ...identity, organizationId: "insurer-b" },
      now,
    )!,
    /another organization/,
  );
  assert.match(
    invitationAcceptanceError(invitation, { ...identity, role: "agent" }, now)!,
    /cannot grant or change staff/,
  );
  assert.match(
    invitationAcceptanceError({ ...invitation, role: "admin" }, identity, now)!,
    /cannot grant or change staff/,
  );
});

test("staff invitations preserve consistent global roles and cannot promote enrolled policyholders", () => {
  const staffInvite = {
    ...invitation,
    purpose: "staff" as const,
    role: "agent" as const,
  };
  assert.equal(invitationAcceptanceError(staffInvite, identity, now), null);
  assert.equal(
    invitationAcceptanceError(
      staffInvite,
      { ...identity, role: "agent", organizationId: "insurer-b" },
      now,
    ),
    null,
  );
  assert.match(
    invitationAcceptanceError(
      staffInvite,
      { ...identity, role: "head_agent" },
      now,
    )!,
    /consistent/,
  );
  assert.match(
    invitationAcceptanceError(
      staffInvite,
      { ...identity, organizationId: "insurer-a" },
      now,
    )!,
    /cannot be promoted/,
  );
  assert.match(
    invitationAcceptanceError({ ...staffInvite, role: "user" }, identity, now)!,
    /invalid role/,
  );
});

test("generated tokens have sufficient entropy, hashes do not preserve raw secrets, resend rotation changes the digest", () => {
  const first = createInvitationToken();
  const second = createInvitationToken();
  assert.ok(isInvitationToken(first));
  assert.equal(first.length, 64);
  assert.notEqual(first, second);
  assert.notEqual(hashInvitationToken(first), first);
  assert.notEqual(hashInvitationToken(first), hashInvitationToken(second));
  assert.equal(hashInvitationToken(first), hashInvitationToken(first));
  assert.equal(isInvitationToken("../sign-in"), false);
});

test("contact normalization preserves valid international numbers and rejects invalid inputs", () => {
  assert.equal(normalizeEmail("  PERSON@EXAMPLE.TEST "), "person@example.test");
  assert.equal(normalizedPhone("+254 712-345-678"), "+254712345678");
  assert.equal(normalizedPhone("not a phone"), null);
  assert.equal(normalizedPhone("123"), null);
});

test("auth continuations preserve the invitation and reject external or malformed redirect destinations", () => {
  const token = "a".repeat(64);
  assert.equal(invitationContinuation(token), `/invitations/${token}`);
  assert.equal(
    safeAuthContinuation(`/invitations/${token}`),
    `/invitations/${token}`,
  );
  assert.equal(safeAuthContinuation("/dashboard/user"), "/dashboard/user");
  for (const unsafe of [
    "https://example.test",
    "//example.test",
    "/invitations/not-a-token",
    "/dashboard/../evil",
    "/dashboard?next=https://example.test",
  ]) {
    assert.equal(safeAuthContinuation(unsafe), "/dashboard");
  }
});
