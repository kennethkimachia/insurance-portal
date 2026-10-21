"use server";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  invitations,
  clerkRoleOperations,
  auditEvents,
} from "@/db/schema";
import { stageInvitationRole, processRoleOperation } from "@/lib/clerk-role-operations";
import { requireSession } from "@/lib/session";
import { and, eq, notInArray } from "drizzle-orm";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
} from "@/lib/invitation-policy";
import {
  authorizeInvitationManagement,
  deliverInvitation,
  invitationPreview,
  listPortalInvitations,
} from "@/lib/invitations";
import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/transaction-identity";

export async function getInvitationPreview(token: string) {
  return invitationPreview(token);
}

export async function acceptPortalInvitation(token: string) {
  try {
    const id = await stageInvitationRole(token);
    const result = await processRoleOperation(id);
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) {
    return { success: false as const, error: actionError(error, "Could not accept the invitation.") };
  }
}

export async function retryPortalRoleUpdate(id: string) {
  try {
    const result = await processRoleOperation(id);
    revalidatePath("/dashboard", "layout");
    revalidatePath("/auth/continue");
    return result;
  } catch (error) { return { success: false as const, error: actionError(error) }; }
}

export async function cancelPortalRoleUpdate(id: string) {
  try {
    const result = await processRoleOperation(id, true);
    revalidatePath("/dashboard", "layout");
    return result;
  } catch (error) { return { success: false as const, error: actionError(error) }; }
}

export async function resendPortalInvitation(id: string) {
  try {
    const actor = await requireSession();
    const token = createInvitationToken();
    const invitation = await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor);
      const [record] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.id, id))
        .for("update");
      if (!record) throw new Error("Invitation not found.");
      await authorizeInvitationManagement(actor, record);
      const [roleUpdate] = await tx.select({ id: clerkRoleOperations.id }).from(clerkRoleOperations)
        .where(and(eq(clerkRoleOperations.invitationId, id), notInArray(clerkRoleOperations.status, ["applied", "cancelled"])));
      if (roleUpdate) throw new Error("Retry or cancel the pending access update before changing this invitation.");
      if (record.status === "accepted" || record.revokedAt)
        throw new Error(
          "Create a new invitation; this one has already been accepted or revoked.",
        );
      const [rotated] = await tx
        .update(invitations)
        .set({
          token: hashInvitationToken(token),
          status: "pending",
          expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
          deliveryState: "pending",
          deliveryError: null,
        })
        .where(eq(invitations.id, id))
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          organizationId: record.organizationId,
          action: "invitation_resent",
          details: { invitationId: id },
        });
      return rotated;
    });
    const delivery = await deliverInvitation(invitation, token);
    revalidatePath("/dashboard", "layout");
    return { success: true as const, ...delivery };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not resend the invitation."),
    };
  }
}

export async function revokePortalInvitation(id: string) {
  try {
    const actor = await requireSession();
    await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor);
      const [record] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.id, id))
        .for("update");
      if (!record) throw new Error("Invitation not found.");
      await authorizeInvitationManagement(actor, record);
      const [roleUpdate] = await tx.select({ id: clerkRoleOperations.id }).from(clerkRoleOperations)
        .where(and(eq(clerkRoleOperations.invitationId, id), notInArray(clerkRoleOperations.status, ["applied", "cancelled"])));
      if (roleUpdate) throw new Error("Retry or cancel the pending access update before changing this invitation.");
      if (record.status === "accepted" || record.revokedAt)
        throw new Error(
          "This invitation has already been accepted or revoked.",
        );
      await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(eq(invitations.id, id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          organizationId: record.organizationId,
          action: "invitation_revoked",
          details: { invitationId: id },
        });
    });
    revalidatePath("/dashboard", "layout");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not revoke the invitation."),
    };
  }
}

export async function getPolicyholderInvitations(organizationId: string) {
  const actor = await requireSession();
  return listPortalInvitations(actor, "policyholder", organizationId);
}
