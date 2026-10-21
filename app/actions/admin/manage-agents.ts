"use server";
import { getActorProfile } from "@/lib/clerk-directory";
import { actorAllowsAccess } from "@/lib/clerk-profile-policy";
import { projectClerkProfile } from "@/lib/clerk-profile-policy";
import { clerkClient } from "@clerk/nextjs/server";
import { stageStaffRole, processRoleOperation } from "@/lib/clerk-role-operations";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  agentOrganizations,
  organizations,
  portalActors,
  clerkRoleOperations,
  claims,
  auditEvents,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { permissions, requirePermission } from "@/lib/permissions";
import { and, eq, notInArray, desc } from "drizzle-orm";
import { z } from "zod";
import { createPortalInvitation } from "@/lib/invitations";
import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/transaction-identity";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "head_agent", "agent"]),
  organizationId: z.string().uuid(),
});
export async function inviteAgent(data: z.infer<typeof inviteSchema>) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.USER_INVITE);
    const parsed = inviteSchema.safeParse(data);
    if (!parsed.success)
      return {
        success: false as const,
        error: "A valid email, staff role, and organization are required.",
      };
    const result = await createPortalInvitation({
      actor,
      ...parsed.data,
      purpose: "staff",
    });
    revalidatePath("/dashboard/admin");
    return result;
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not create the invitation."),
    };
  }
}

export async function assignAgentToOrganization(
  agentId: string,
  organizationId: string,
) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.AGENT_WRITE);
    const assignment = await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor, [agentId]);
      const [agent] = await tx
        .select()
        .from(portalActors)
        .where(eq(portalActors.id, agentId))
        .for("update");
      const agentProfile = await getActorProfile(agentId);
      const [organization] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      if (
        !agent ||
        !["agent", "head_agent"].includes(agentProfile.role ?? "") || !agentProfile.emailVerified || agentProfile.banned ||
        !actorAllowsAccess(agent, Date.now())
      )
        throw new Error(
          "Only active agents and claims managers can be assigned.",
        );
      if (!organization) throw new Error("Organization not found.");
      const [created] = await tx
        .insert(agentOrganizations)
        .values({ agentId, organizationId })
        .onConflictDoNothing()
        .returning({ id: agentOrganizations.id });
      if (!created)
        throw new Error(
          "This staff member already belongs to the organization.",
        );
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          targetUserId: agentId,
          organizationId,
          action: "membership_added",
          details: { membershipId: created.id },
        });
      return created;
    });
    revalidatePath("/dashboard", "layout");
    return { success: true as const, assignmentId: assignment.id };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not add membership."),
    };
  }
}

export async function removeAgentFromOrganization(assignmentId: string) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.AGENT_WRITE);
    await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(agentOrganizations)
        .where(eq(agentOrganizations.id, assignmentId))
        .limit(1);
      if (!assignment) throw new Error("Membership not found.");
      await requireCurrentActor(tx, actor, [assignment.agentId]);
      await tx
        .select({ id: portalActors.id })
        .from(portalActors)
        .where(eq(portalActors.id, assignment.agentId))
        .for("update");
      const work = await tx
        .select({ id: claims.id })
        .from(claims)
        .where(
          and(
            eq(claims.assignedAgentId, assignment.agentId),
            eq(claims.organizationId, assignment.organizationId),
            notInArray(claims.status, ["settled", "rejected", "withdrawn"]),
          ),
        );
      if (work.length)
        throw new Error(
          `Reassign ${work.length} open claim${work.length === 1 ? "" : "s"} before removing this membership.`,
        );
      await tx
        .delete(agentOrganizations)
        .where(eq(agentOrganizations.id, assignmentId));
      await tx.update(portalActors).set({ sessionsValidAfter: new Date() }).where(eq(portalActors.id, assignment.agentId));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          targetUserId: assignment.agentId,
          organizationId: assignment.organizationId,
          action: "membership_removed",
          details: { membershipId: assignmentId, sessionsRevoked: true },
        });
    });
    revalidatePath("/dashboard", "layout");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not remove membership."),
    };
  }
}

export async function setStaffSuspension(
  id: string,
  suspended: boolean,
  reason: string,
) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.USER_MANAGE);
    if (id === actor.id)
      throw new Error("You cannot suspend your own account.");
    if (reason.trim().length < 5 || reason.length > 500)
      throw new Error(
        "Provide an access-change reason of 5 to 500 characters.",
      );
    await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor, [id]);
      const [staff] = await tx
        .select()
        .from(portalActors)
        .where(eq(portalActors.id, id))
        .for("update");
      const staffProfile = await getActorProfile(id);
      if (!staff || !staffProfile.role || staffProfile.role === "user")
        throw new Error("Staff account not found.");
      if (!suspended && staff.suspensionReason === "Cancelled Clerk role update: review role before reinstatement.")
        throw new Error("Use the cancelled-update review controls to reinstate this account.");
      if (suspended) {
        const work = await tx
          .select({ id: claims.id })
          .from(claims)
          .where(
            and(
              eq(claims.assignedAgentId, id),
              notInArray(claims.status, ["settled", "rejected", "withdrawn"]),
            ),
          );
        if (work.length)
          throw new Error(
            `Reassign ${work.length} open claim${work.length === 1 ? "" : "s"} before suspending this account.`,
          );
      }
      await tx
        .update(portalActors)
        .set({
          suspendedAt: suspended ? new Date() : null,
          suspensionReason: suspended ? reason.trim() : null,
          sessionsValidAfter: new Date(),
        })
        .where(eq(portalActors.id, id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          targetUserId: id,
          action: suspended ? "staff_suspended" : "staff_reinstated",
          details: { reason: reason.trim(), sessionsRevoked: true },
        });
    });
    revalidatePath("/dashboard", "layout");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not change staff access."),
    };
  }
}

export async function revokeStaffSessions(id: string) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.USER_MANAGE);
    const staff = await getActorProfile(id);
    if (!staff.role || staff.role === "user") throw new Error("Staff account not found.");
    await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor, [id]);
      await tx.update(portalActors).set({ sessionsValidAfter: new Date() }).where(eq(portalActors.id, id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          targetUserId: id,
          action: "staff_sessions_revoked",
          details: {},
        });
    });
    revalidatePath("/dashboard/admin");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not revoke sessions."),
    };
  }
}

export async function changeStaffRole(id: string, role: "admin" | "head_agent" | "agent") {
  try {
    const actor = await requireSession();
    const desiredRole = z.enum(["admin", "head_agent", "agent"]).parse(role);
    const operationId = await stageStaffRole(actor, z.string().uuid().parse(id), desiredRole);
    const result = await processRoleOperation(operationId);
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) { return { success: false as const, error: actionError(error) }; }
}

export async function reinstateCancelledRoleAccount(id: string, reason: string) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.USER_MANAGE);
    z.string().uuid().parse(id);
    if (reason.trim().length < 5 || reason.length > 500) throw new Error("Record why the restored Clerk role is safe to reinstate (5 to 500 characters).");
    await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor, [id]);
      const [target] = await tx.select().from(portalActors).where(eq(portalActors.id, id));
      const [operation] = await tx.select().from(clerkRoleOperations).where(and(eq(clerkRoleOperations.actorId, id), eq(clerkRoleOperations.status, "cancelled"))).orderBy(desc(clerkRoleOperations.completedAt)).limit(1);
      if (!target?.clerkUserId || target.pendingRoleOperationId || target.retiredAt || !target.suspendedAt || target.suspensionReason !== "Cancelled Clerk role update: review role before reinstatement." || !operation)
        throw new Error("This account does not have a cancelled update awaiting review.");
      const user = await (await clerkClient()).users.getUser(target.clerkUserId);
      const profile = projectClerkProfile(user);
      if (profile.banned || !profile.emailVerified || profile.invalidRole || profile.role !== operation.previousRole || user.publicMetadata.portalRoleOperationId != null)
        throw new Error("Review Clerk metadata: restore the prior role and clear the operation marker before reinstating.");
      await tx.update(portalActors).set({ suspendedAt: null, suspensionReason: null, sessionsValidAfter: new Date() }).where(eq(portalActors.id, id));
      await tx.insert(auditEvents).values({ actorId: actor.id, targetUserId: id, action: "cancelled_role_account_reinstated", details: { operationId: operation.id, reason: reason.trim() } });
    });
    revalidatePath("/dashboard", "layout");
    return { success: true as const };
  } catch (error) { return { success: false as const, error: actionError(error) }; }
}
