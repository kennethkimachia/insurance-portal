import "server-only";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { portalActors, clerkRoleOperations, invitations, policies, policyholderEnrollments, agentOrganizations, auditEvents, claims } from "@/db/schema";
import { and, eq, notInArray, sql, isNull } from "drizzle-orm";
import { getAuthenticatedClerkIdentity, requireSession, type SessionUser } from "./session";
import { getActorProfile } from "./clerk-directory";
import { projectClerkProfile } from "./clerk-profile-policy";
import { operationLeaseAvailable, roleWriteDecision } from "./clerk-role-policy";
import { invitationAcceptanceError, hashInvitationToken, isInvitationToken } from "./invitation-policy";
import { requireCurrentActor } from "./transaction-identity";
import type { Role } from "./permissions";
import { actionError } from "./action-errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Invitation = typeof invitations.$inferSelect;
type Operation = typeof clerkRoleOperations.$inferSelect;

async function validateEnrollment(tx: Tx, actorId: string, invitation: Invitation, profile: ReturnType<typeof projectClerkProfile>, previousRole = profile.role) {
  const [actor] = await tx.select().from(portalActors).where(eq(portalActors.id, actorId));
  const [enrollment] = await tx.select().from(policyholderEnrollments).where(eq(policyholderEnrollments.actorId, actorId));
  if (!actor || actor.retiredAt || profile.banned || !profile.available || profile.invalidRole)
    throw new Error("This account cannot accept portal access.");
  const error = invitationAcceptanceError(invitation, { ...profile, role: previousRole, organizationId: enrollment?.organizationId ?? null, suspendedAt: actor.suspendedAt });
  if (error) throw new Error(error);
  const existing = await tx.select({ id: policies.id }).from(policies).where(and(eq(policies.userId, actorId),
    invitation.purpose === "policyholder" ? eq(policies.policyType, invitation.enrollmentPolicyType!) : undefined)).limit(1);
  if (existing.length) throw new Error(invitation.purpose === "staff" ? "A policyholder account cannot accept staff access." : "You already have a policy of this type. Ask your agent to review it.");
  if (invitation.purpose === "policyholder" && (!invitation.enrollmentPolicyType || !invitation.enrollmentPolicyNumber || !invitation.enrollmentPhone || !invitation.policyProfile))
    throw new Error("This enrollment is incomplete. Ask your agent to replace the invitation.");
}

export async function stageInvitationRole(token: string) {
  const identity = await getAuthenticatedClerkIdentity();
  if (!identity || !identity.emailVerified) throw new Error("Sign in with a verified primary email before accepting.");
  if (!isInvitationToken(token)) throw new Error("This invitation link is invalid.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`clerk:${identity.clerkUserId}`}, 0))`);
    let [actor] = await tx.select().from(portalActors).where(eq(portalActors.clerkUserId, identity.clerkUserId)).for("update");
    const [invitation] = await tx.select().from(invitations).where(eq(invitations.token, hashInvitationToken(token))).for("update");
    if (!invitation) throw new Error("This invitation is invalid.");
    if (identity.email !== invitation.email.toLowerCase()) throw new Error("Sign in with the email address this invitation was sent to.");
    if (!actor) {
      if (identity.linkedActorId) {
        const [legacy] = await tx.select().from(portalActors).where(eq(portalActors.id, identity.linkedActorId)).for("update");
        if (!legacy || legacy.clerkUserId) throw new Error("This legacy UUID is missing or already linked. Ask your administrator to review it.");
        [actor] = await tx.update(portalActors).set({ clerkUserId: identity.clerkUserId }).where(and(eq(portalActors.id, legacy.id), isNull(portalActors.clerkUserId))).returning();
      } else [actor] = await tx.insert(portalActors).values({ clerkUserId: identity.clerkUserId }).returning();
    }
    if (actor.sessionsValidAfter && (await (await clerkClient()).sessions.getSession(identity.clerkSessionId)).createdAt <= actor.sessionsValidAfter.getTime())
      throw new Error("Your portal sessions were revoked. Sign out and sign in again.");
    const [existing] = await tx.select().from(clerkRoleOperations).where(eq(clerkRoleOperations.idempotencyKey, `invitation:${invitation.id}`));
    if (existing) {
      if (existing.actorId !== actor.id || existing.status === "cancelled") throw new Error("Ask the sender for a new invitation.");
      return existing.id;
    }
    if (actor.pendingRoleOperationId) throw new Error("Another access update is pending. Retry it or contact your administrator.");
    await validateEnrollment(tx, actor.id, invitation, identity);
    const [op] = await tx.insert(clerkRoleOperations).values({ actorId: actor.id, clerkUserId: identity.clerkUserId,
      invitationId: invitation.id, requestedBy: actor.id, desiredRole: invitation.role, previousRole: identity.role,
      idempotencyKey: `invitation:${invitation.id}` }).returning();
    await tx.update(portalActors).set({ pendingRoleOperationId: op.id }).where(eq(portalActors.id, actor.id));
    return op.id;
  });
}

async function validateStaffRole(tx: Tx, actorId: string) {
  const [enrollment] = await tx.select().from(policyholderEnrollments).where(eq(policyholderEnrollments.actorId, actorId));
  const [policy] = await tx.select({ id: policies.id }).from(policies).where(eq(policies.userId, actorId)).limit(1);
  if (enrollment || policy) throw new Error("Policyholder roles cannot be changed to staff roles.");
  const work = await tx.select({ id: claims.id }).from(claims).where(and(eq(claims.assignedAgentId, actorId), notInArray(claims.status, ["settled", "rejected", "withdrawn"])));
  if (work.length) throw new Error("Reassign open claims before changing this staff role.");
}

export async function stageStaffRole(actor: SessionUser, targetId: string, desiredRole: Exclude<Role, "user">) {
  if (actor.role !== "admin") throw new Error("Administrator access is required.");
  if (actor.id === targetId) throw new Error("Ask another administrator to change your role.");
  return db.transaction(async (tx) => {
    await requireCurrentActor(tx, actor, [targetId]);
    const [target] = await tx.select().from(portalActors).where(eq(portalActors.id, targetId));
    const profile = await getActorProfile(targetId);
    if (!target?.clerkUserId || !target.enrolledAt || target.retiredAt || target.suspendedAt || target.pendingRoleOperationId || !profile.emailVerified || profile.banned || !profile.role || profile.role === "user")
      throw new Error("Choose an active staff account without pending changes.");
    if (profile.role === desiredRole) throw new Error("This account already has that role.");
    await validateStaffRole(tx, targetId);
    const [op] = await tx.insert(clerkRoleOperations).values({ actorId: targetId, clerkUserId: target.clerkUserId,
      requestedBy: actor.id, desiredRole, previousRole: profile.role, idempotencyKey: `staff:${randomUUID()}` }).returning();
    await tx.update(portalActors).set({ pendingRoleOperationId: op.id }).where(eq(portalActors.id, targetId));
    return op.id;
  });
}

async function authorizeOperation(op: Operation, cancel: boolean) {
  const identity = await getAuthenticatedClerkIdentity();
  if (!cancel && op.invitationId && identity?.clerkUserId === op.clerkUserId && identity.emailVerified) return;
  const actor = await requireSession();
  if (actor.role !== "admin") throw new Error("Only the invited account or an administrator can retry this update.");
  // Fresh identity and local gates are checked even on retry/cancellation.
  await db.transaction((tx) => requireCurrentActor(tx, actor));
}

/** Durable local gate + expiring lease. Remote failure never grants domain access. */
export async function processRoleOperation(id: string, cancel = false) {
  const [initial] = await db.select().from(clerkRoleOperations).where(eq(clerkRoleOperations.id, id));
  if (!initial) throw new Error("Access update not found.");
  await authorizeOperation(initial, cancel);
  if (initial.status === "applied" && !cancel) return { success: true as const };
  const leaseToken = randomUUID();
  const op = await db.transaction(async (tx) => {
    // Actor before operation is the lock order used by staging/finalization.
    await tx.select().from(portalActors).where(eq(portalActors.id, initial.actorId)).for("update");
    const [current] = await tx.select().from(clerkRoleOperations).where(eq(clerkRoleOperations.id, id)).for("update");
    if (!current || !operationLeaseAvailable(current.status, current.leaseExpiresAt, new Date())) throw new Error("This update is complete or is already being processed. Retry shortly.");
    const [leased] = await tx.update(clerkRoleOperations).set({ status: "processing", leaseToken,
      leaseExpiresAt: new Date(Date.now() + 120_000), attempts: current.attempts + 1, lastError: null }).where(eq(clerkRoleOperations.id, id)).returning();
    return leased;
  });
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(op.clerkUserId).catch(async (error: unknown) => {
      if (!cancel || typeof error !== "object" || error === null || !("status" in error) || error.status !== 404) throw error;
      // A deleted Clerk account has no role to restore. Preserve its historical
      // UUID, permanently retire access, and cancel only this leased operation.
      await db.transaction(async (tx) => {
        const [actor] = await tx.select().from(portalActors).where(eq(portalActors.id, op.actorId)).for("update");
        const [current] = await tx.select().from(clerkRoleOperations).where(eq(clerkRoleOperations.id, id)).for("update");
        if (!actor || actor.pendingRoleOperationId !== id || current?.leaseToken !== leaseToken || current.status !== "processing") throw new Error("Another worker owns this update. Retry shortly.");
        await tx.update(portalActors).set({ retiredAt: new Date(), pendingRoleOperationId: null, sessionsValidAfter: new Date() }).where(eq(portalActors.id, actor.id));
        await tx.update(clerkRoleOperations).set({ status: "cancelled", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, lastError: null }).where(eq(clerkRoleOperations.id, id));
        await tx.insert(auditEvents).values({ actorId: op.requestedBy, targetUserId: actor.id, action: "deleted_clerk_account_retired", details: { operationId: id } });
      });
      return null;
    });
    if (!user) return { success: true as const };
    const profile = projectClerkProfile(user);
    const decision = roleWriteDecision({ operationId: op.id, previousRole: op.previousRole, desiredRole: op.desiredRole,
      currentRole: profile.role, currentOperationId: user.publicMetadata.portalRoleOperationId, invalidRole: profile.invalidRole });
    if (decision === "conflict") throw new Error("Clerk role changed independently. Review the role in Clerk before retrying or cancelling.");
    if (!cancel) {
      if (!profile.emailVerified || profile.banned) throw new Error("Verify or reinstate the Clerk account before retrying.");
      // Validate domain eligibility before the external write, and again at finalization.
      await db.transaction(async (tx) => {
        const [actor] = await tx.select().from(portalActors).where(eq(portalActors.id, op.actorId)).for("update");
        if (!actor || actor.pendingRoleOperationId !== op.id || actor.suspendedAt || actor.retiredAt) throw new Error("Portal access changed. Ask an administrator to cancel this update.");
        if (op.invitationId) {
          const [invite] = await tx.select().from(invitations).where(eq(invitations.id, op.invitationId)).for("update");
          if (!invite) throw new Error("Invitation not found.");
          await validateEnrollment(tx, op.actorId, invite, profile, op.previousRole);
        } else await validateStaffRole(tx, op.actorId);
      });
    }
    if (cancel || decision === "write") await client.users.updateUserMetadata(op.clerkUserId, {
      publicMetadata: { portalRole: cancel ? op.previousRole : op.desiredRole,
        portalRoleOperationId: cancel ? null : op.id },
    });
    // Use a fresh backend read after the write; never finalize using a stale request cache.
    const confirmedUser = await client.users.getUser(op.clerkUserId);
    const confirmed = projectClerkProfile(confirmedUser);
    if (confirmed.invalidRole || confirmed.role !== (cancel ? op.previousRole : op.desiredRole) ||
      (cancel ? confirmedUser.publicMetadata.portalRoleOperationId != null : confirmedUser.publicMetadata.portalRoleOperationId !== op.id))
      throw new Error("Clerk role confirmation failed. Retry the access update.");
    await db.transaction(async (tx) => {
      const [actor] = await tx.select().from(portalActors).where(eq(portalActors.id, op.actorId)).for("update");
      const [current] = await tx.select().from(clerkRoleOperations).where(eq(clerkRoleOperations.id, id)).for("update");
      if (!actor || actor.pendingRoleOperationId !== id || current?.leaseToken !== leaseToken || current.status !== "processing") throw new Error("Another worker owns this update. Retry shortly.");
      if (!cancel) {
        if (actor.suspendedAt || actor.retiredAt || confirmed.banned || !confirmed.emailVerified)
          throw new Error("Account access changed before finalization. Review or cancel this update.");
        if (op.invitationId) {
          const [invite] = await tx.select().from(invitations).where(eq(invitations.id, op.invitationId)).for("update");
          if (!invite) throw new Error("Invitation not found.");
          await validateEnrollment(tx, actor.id, invite, confirmed, op.previousRole);
          if (invite.purpose === "policyholder") {
            await tx.insert(policyholderEnrollments).values({ actorId: actor.id, organizationId: invite.organizationId, phone: invite.enrollmentPhone })
              .onConflictDoUpdate({ target: policyholderEnrollments.actorId, set: { phone: invite.enrollmentPhone } });
            await tx.insert(policies).values({ policyNumber: invite.enrollmentPolicyNumber!, policyType: invite.enrollmentPolicyType!, userId: actor.id,
              organizationId: invite.organizationId, status: "active", ...invite.policyProfile! });
          } else if (op.desiredRole !== "admin") await tx.insert(agentOrganizations).values({ agentId: actor.id, organizationId: invite.organizationId }).onConflictDoNothing();
          await tx.update(invitations).set({ status: "accepted", acceptedBy: actor.id, acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
        } else await validateStaffRole(tx, actor.id);
      }
      await tx.update(portalActors).set({ pendingRoleOperationId: null, ...(!cancel ? { enrolledAt: actor.enrolledAt ?? new Date() } : {
        suspendedAt: new Date(), suspensionReason: "Cancelled Clerk role update: review role before reinstatement.", sessionsValidAfter: new Date(),
      }) }).where(eq(portalActors.id, actor.id));
      await tx.update(clerkRoleOperations).set({ status: cancel ? "cancelled" : "applied", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null, lastError: null }).where(eq(clerkRoleOperations.id, id));
      await tx.insert(auditEvents).values({ actorId: op.requestedBy, targetUserId: actor.id,
        action: cancel ? "clerk_role_update_cancelled" : op.invitationId ? "invitation_accepted" : "clerk_role_updated",
        details: { operationId: id, invitationId: op.invitationId, previousRole: op.previousRole, role: cancel ? op.previousRole : op.desiredRole } });
    });
    return { success: true as const };
  } catch (error) {
    const safeError = actionError(error, "Access update did not finish. Retry, or review Clerk metadata and invitation eligibility before cancelling.");
    await db.update(clerkRoleOperations).set({ status: "blocked", leaseToken: null, leaseExpiresAt: null,
      lastError: safeError })
      .where(and(eq(clerkRoleOperations.id, id), eq(clerkRoleOperations.leaseToken, leaseToken)));
    return { success: false as const, error: "Your access update is saved but incomplete. Retry it here. An administrator can review or cancel it; portal access stays paused until it finishes." };
  }
}
