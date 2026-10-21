import assert from "node:assert/strict";
import test from "node:test";
import { actorAllowsAccess, loadClerkProfiles, parsePortalRole, projectClerkProfile, unavailableProfile, type ClerkProfileInput } from "../lib/clerk-profile-policy";
import { operationLeaseAvailable, roleWriteDecision } from "../lib/clerk-role-policy";
import { invitationAcceptanceError } from "../lib/invitation-policy";

const profile: ClerkProfileInput = {
  id: "user_holder", firstName: "Account", lastName: "Holder", imageUrl: "avatar",
  primaryEmailAddressId: "primary", emailAddresses: [
    { id: "primary", emailAddress: " Holder@Example.test ", verification: { status: "verified" } },
    { id: "secondary", emailAddress: "staff@example.test", verification: { status: "verified" } },
  ], publicMetadata: { portalRole: "user" }, banned: false,
};
const actor = { enrolledAt: new Date(1), suspendedAt: null, retiredAt: null, pendingRoleOperationId: null, sessionsValidAfter: null };

test("Clerk metadata has exactly four roles; missing or malformed values never grant a default role", () => {
  for (const role of ["admin", "head_agent", "agent", "user"]) assert.equal(parsePortalRole(role), role);
  for (const invalid of [null, undefined, "", "ADMIN", "owner", { role: "admin" }, ["admin"]]) assert.equal(parsePortalRole(invalid), null);
  assert.equal(projectClerkProfile({ ...profile, publicMetadata: {} }).role, null);
  assert.equal(projectClerkProfile({ ...profile, publicMetadata: { portalRole: "owner" } }).invalidRole, true);
});

test("only the verified primary email establishes invitation eligibility", () => {
  assert.equal(projectClerkProfile(profile).email, "holder@example.test");
  const unverified = projectClerkProfile({ ...profile, emailAddresses: [{ ...profile.emailAddresses[0], verification: null }, profile.emailAddresses[1]] });
  assert.equal(unverified.emailVerified, false);
  assert.equal(projectClerkProfile({ ...profile, primaryEmailAddressId: "missing" }).emailVerified, false);
});

test("profile changes are projected from Clerk without changing UUID ownership", () => {
  const before = projectClerkProfile(profile);
  const after = projectClerkProfile({ ...profile, firstName: "Updated", emailAddresses: [{ ...profile.emailAddresses[0], emailAddress: "new@example.test" }], publicMetadata: { portalRole: "agent" } });
  assert.equal(after.clerkUserId, before.clerkUserId);
  assert.equal(after.name, "Updated Holder");
  assert.equal(after.email, "new@example.test");
  assert.equal(after.role, "agent");
});

test("legacy UUID linking reads backend-only private metadata and rejects malformed IDs", () => {
  const uuid = "dd2c12bc-9e80-4f4b-b5bf-2f67758f9c22";
  assert.equal(projectClerkProfile({ ...profile, privateMetadata: { portalActorId: uuid } }).linkedActorId, uuid);
  assert.equal(projectClerkProfile({ ...profile, privateMetadata: { portalActorId: "bad" }, publicMetadata: { portalActorId: uuid } }).linkedActorId, null);
});

test("missing or deleted profiles have no role and cannot authorize access", () => {
  const missing = unavailableProfile("user_deleted");
  assert.equal(missing.role, null);
  assert.equal(missing.emailVerified, false);
  assert.equal(missing.banned, true);
  assert.equal(missing.available, false);
});

test("enrollment, suspension, retirement and pending operations are independent local access gates", () => {
  assert.equal(actorAllowsAccess(actor, null), true);
  assert.equal(actorAllowsAccess({ ...actor, enrolledAt: null }, null), false);
  assert.equal(actorAllowsAccess({ ...actor, suspendedAt: new Date(1) }, null), false);
  assert.equal(actorAllowsAccess({ ...actor, retiredAt: new Date(1) }, null), false);
  assert.equal(actorAllowsAccess({ ...actor, pendingRoleOperationId: "pending" }, null), false);
});

test("revocation requires a session strictly newer than the cutoff", () => {
  const cutoff = { ...actor, sessionsValidAfter: new Date(100) };
  for (const createdAt of [null, 99, 100]) assert.equal(actorAllowsAccess(cutoff, createdAt), false);
  assert.equal(actorAllowsAccess(cutoff, 101), true);
});

test("directory hydration deduplicates, batches 100 IDs, and ignores unexpected records", async () => {
  const ids = Array.from({ length: 205 }, (_, i) => `user_${i}`);
  const batches: number[] = [];
  const loaded = await loadClerkProfiles([...ids, ids[0], ""], async ({ userId, limit }) => {
    assert.equal(limit, 100); batches.push(userId.length);
    return { data: [...userId.map((id) => ({ id })), { id: "not_requested" }], totalCount: userId.length };
  });
  assert.deepEqual(batches, [100, 100, 5]);
  assert.equal(loaded.size, 205);
  assert.equal(loaded.has("not_requested"), false);
});

test("directory hydration follows short pages and preserves missing references", async () => {
  const offsets: number[] = [];
  const loaded = await loadClerkProfiles(["a", "b", "deleted"], async ({ offset }) => {
    offsets.push(offset); return { data: [{ id: offset === 0 ? "a" : "b" }], totalCount: 2 };
  });
  assert.deepEqual(offsets, [0, 1]);
  assert.equal(loaded.has("deleted"), false);
});

test("Clerk outages fail the request instead of substituting a local profile", async () => {
  await assert.rejects(loadClerkProfiles(["a"], async () => { throw new Error("rate limited"); }), /rate limited/);
});

const operation = { operationId: "op", previousRole: null, desiredRole: "agent" as const, currentRole: null, currentOperationId: undefined, invalidRole: false };
test("an authorized first enrollment can write its role", () => assert.equal(roleWriteDecision(operation), "write"));
test("a retry after the remote write is idempotent", () => {
  assert.equal(roleWriteDecision({ ...operation, currentRole: "agent", currentOperationId: "op" }), "already-applied");
});
test("independent Dashboard edits and invalid metadata block a role overwrite", () => {
  assert.equal(roleWriteDecision({ ...operation, currentRole: "admin" }), "conflict");
  assert.equal(roleWriteDecision({ ...operation, currentRole: "agent", currentOperationId: "different" }), "conflict");
  assert.equal(roleWriteDecision({ ...operation, invalidRole: true }), "conflict");
});
test("a staff role retry may write only from its recorded prior role", () => {
  assert.equal(roleWriteDecision({ ...operation, previousRole: "agent", currentRole: "agent", desiredRole: "head_agent" }), "write");
  assert.equal(roleWriteDecision({ ...operation, previousRole: "agent", currentRole: "admin", desiredRole: "head_agent" }), "conflict");
});
test("an active processing lease rejects another worker while failed or expired updates can retry", () => {
  const now = new Date(1000);
  assert.equal(operationLeaseAvailable("processing", new Date(1001), now), false);
  assert.equal(operationLeaseAvailable("processing", now, now), true);
  for (const status of ["pending", "blocked"]) assert.equal(operationLeaseAvailable(status, null, now), true);
  for (const status of ["applied", "cancelled"]) assert.equal(operationLeaseAvailable(status, null, now), false);
});
test("unassigned Clerk identities may accept only an explicit verified invitation, retaining domain restrictions", () => {
  const invite = { email: "holder@example.test", role: "user" as const, purpose: "policyholder" as const, organizationId: "a", status: "pending", expiresAt: new Date(2000) };
  const identity = { email: "holder@example.test", emailVerified: true, role: null, organizationId: null };
  assert.equal(invitationAcceptanceError(invite, identity, new Date(1000)), null);
  assert.equal(invitationAcceptanceError({ ...invite, purpose: "staff", role: "agent" }, identity, new Date(1000)), null);
  assert.match(invitationAcceptanceError(invite, { ...identity, organizationId: "b" }, new Date(1000))!, /another organization/);
  assert.match(invitationAcceptanceError(invite, { ...identity, emailVerified: false }, new Date(1000))!, /Verify/);
});
