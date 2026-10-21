import assert from "node:assert/strict";
import test from "node:test";
import { canLinkClerkIdentity, clerkEmailIsVerified, clerkSessionIsCurrent } from "../lib/clerk-identity-policy";

test("only a verified Clerk email can establish portal identity", () => {
  assert.equal(clerkEmailIsVerified(null), false);
  assert.equal(clerkEmailIsVerified({ emailAddress: "user@example.test" }), false);
  assert.equal(clerkEmailIsVerified({ emailAddress: "user@example.test", verification: { status: "unverified" } }), false);
  assert.equal(clerkEmailIsVerified({ emailAddress: "user@example.test", verification: { status: "verified" } }), true);
});

test("account linking cannot transfer an identity already linked elsewhere", () => {
  assert.equal(canLinkClerkIdentity([], "user_a"), true);
  assert.equal(canLinkClerkIdentity(["user_a"], "user_a"), true);
  assert.equal(canLinkClerkIdentity(["user_a"], "user_b"), false);
  assert.equal(canLinkClerkIdentity(["user_a", "user_b"], "user_a"), false);
});

test("portal revocation rejects existing sessions and allows a fresh sign-in", () => {
  const cutoff = new Date("2026-10-05T08:00:00Z");
  assert.equal(clerkSessionIsCurrent(cutoff.getTime() - 1, cutoff), false);
  assert.equal(clerkSessionIsCurrent(cutoff.getTime(), cutoff), false);
  assert.equal(clerkSessionIsCurrent(cutoff.getTime() + 1, cutoff), true);
  assert.equal(clerkSessionIsCurrent(cutoff.getTime() - 1, null), true);
});
