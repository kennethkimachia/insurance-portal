import { findClerkProfileByEmail, getActorProfiles, profileFor } from "@/lib/clerk-directory";
import { db } from "@/db";
import {
  invitations,
  organizations,
  portalActors,
  policyholderEnrollments,
  policies,
  auditEvents,
} from "@/db/schema";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { getInviteEmailHtml } from "@/lib/emailTemplates";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  invitationState,
  isInvitationToken,
  normalizeEmail,
} from "@/lib/invitation-policy";
import type { Role } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { requireOrganizationAccess } from "@/lib/organization-access";
import { requireCurrentActor } from "@/lib/transaction-identity";

type Invitation = typeof invitations.$inferSelect;
export type InvitationSummary = {
  id: string;
  email: string;
  role: Role;
  purpose: "staff" | "policyholder";
  organizationName: string;
  state: "pending" | "accepted" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  deliveryState: Invitation["deliveryState"];
  deliveryError: string | null;
  policyType: "motor" | "burglary" | null;
  policyNumber: string | null;
};

export async function deliverInvitation(invitation: Invitation, token: string) {
  const baseURL =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const link = `${baseURL.replace(/\/$/, "")}/invitations/${token}`;
  const displayRole =
    invitation.purpose === "policyholder"
      ? "Policyholder"
      : {
          admin: "Platform administrator",
          head_agent: "Claims manager",
          agent: "Agent",
          user: "Policyholder",
        }[invitation.role];
  const result = await sendEmail({
    to: invitation.email,
    subject: `Your Insurance Portal ${displayRole.toLowerCase()} invitation`,
    html: getInviteEmailHtml(displayRole, link),
    text: `Accept your Insurance Portal invitation: ${link}. This link expires in seven days.`,
    category: "invitation",
  });
  const deliveryState = result.success
    ? result.mode === "sandbox"
      ? "sandbox"
      : "sent"
    : "failed";
  await db
    .update(invitations)
    .set({
      deliveryState,
      deliveryError: result.success ? null : result.error,
      lastSentAt: new Date(),
    })
    .where(
      and(
        eq(invitations.id, invitation.id),
        eq(invitations.token, hashInvitationToken(token)),
      ),
    );
  return {
    deliveryState,
    message: result.success
      ? result.mode === "sandbox"
        ? "Invitation saved in the configured sandbox inbox. It has not been delivered to the recipient."
        : "Invitation email accepted by the provider. Recipient delivery is not yet confirmed."
      : `Invitation saved. ${result.error}`,
  };
}

export async function createPortalInvitation(input: {
  actor: SessionUser;
  email: string;
  role: Role;
  purpose: "staff" | "policyholder";
  organizationId: string;
  enrollmentName?: string;
  enrollmentPhone?: string;
  enrollmentPolicyType?: "motor" | "burglary";
  policyProfile?: NonNullable<Invitation["policyProfile"]>;
}) {
  const email = normalizeEmail(input.email);
  const token = createInvitationToken();
  const clerkProfile = await findClerkProfileByEmail(email);
  const invitation = await db.transaction(async (tx) => {
    await requireCurrentActor(tx, input.actor);
    // Serialize invitation creation per organization, including duplicate checks.
    const [organization] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .for("update");
    if (!organization) throw new Error("Organization not found.");
    const [mapped] = clerkProfile ? await tx.select().from(portalActors).where(eq(portalActors.clerkUserId, clerkProfile.clerkUserId)) : [];
    const [enrollment] = mapped ? await tx.select().from(policyholderEnrollments).where(eq(policyholderEnrollments.actorId, mapped.id)) : [];
    const identity = clerkProfile ? { ...clerkProfile, id: mapped?.id, organizationId: enrollment?.organizationId ?? null } : null;
    if (mapped?.suspendedAt || mapped?.retiredAt || mapped?.pendingRoleOperationId || clerkProfile?.banned || clerkProfile?.invalidRole)
      throw new Error("This account is unavailable or has a pending access update. Ask the administrator to review it first.");
    if (input.purpose === "policyholder") {
      if (input.role !== "user")
        throw new Error("Policyholder invitations cannot grant staff access.");
      if (
        identity &&
        ((identity.role !== null && identity.role !== "user") ||
          (identity.organizationId &&
            identity.organizationId !== input.organizationId))
      )
        throw new Error(
          "Use a policyholder account belonging to this organization.",
        );
      if (identity?.id) {
        const [existingPolicy] = await tx
          .select({ id: policies.id })
          .from(policies)
          .where(
            and(
              eq(policies.userId, identity.id),
              eq(policies.policyType, input.enrollmentPolicyType!),
            ),
          )
          .limit(1);
        if (existingPolicy)
          throw new Error(
            `This policyholder already has a ${input.enrollmentPolicyType} policy.`,
          );
      }
    } else if (
      identity &&
      ((identity.role === "user" && identity.organizationId) ||
        (identity.role !== null && identity.role !== "user" && identity.role !== input.role))
    ) {
      throw new Error(
        "An existing policyholder cannot become staff through an invitation, and staff roles must be consistent across organizations.",
      );
    }
    const [duplicate] = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.organizationId, input.organizationId),
          eq(invitations.purpose, input.purpose),
          eq(invitations.status, "pending"),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
          ...(input.purpose === "policyholder"
            ? [
                eq(
                  invitations.enrollmentPolicyType,
                  input.enrollmentPolicyType!,
                ),
              ]
            : []),
        ),
      )
      .limit(1);
    if (duplicate)
      throw new Error(
        "An active invitation already exists. Resend it from the invitations list.",
      );
    const policyNumber = input.enrollmentPolicyType
      ? `${input.policyProfile?.source === "manual" ? "MAN" : "DEMO"}-${input.enrollmentPolicyType === "motor" ? "MOT" : "BRG"}-${createInvitationToken().slice(0, 16).toUpperCase()}`
      : null;
    const [created] = await tx
      .insert(invitations)
      .values({
        email,
        role: input.role,
        purpose: input.purpose,
        organizationId: input.organizationId,
        invitedBy: input.actor.id,
        token: hashInvitationToken(token),
        expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
        enrollmentName: input.enrollmentName,
        enrollmentPhone: input.enrollmentPhone,
        enrollmentPolicyType: input.enrollmentPolicyType,
        enrollmentPolicyNumber: policyNumber,
        policyProfile: input.policyProfile,
      })
      .returning();
    await tx
      .insert(auditEvents)
      .values({
        actorId: input.actor.id,
        organizationId: input.organizationId,
        action: "invitation_created",
        details: {
          invitationId: created.id,
          purpose: input.purpose,
          role: input.role,
        },
      });
    return created;
  });
  const delivery = await deliverInvitation(invitation, token);
  return {
    success: true as const,
    invitationId: invitation.id,
    policyNumber: invitation.enrollmentPolicyNumber,
    ...delivery,
  };
}

export async function authorizeInvitationManagement(
  actor: SessionUser,
  invitation: Invitation,
) {
  if (actor.role === "admin") return;
  if (
    invitation.purpose !== "policyholder" ||
    !["agent", "head_agent"].includes(actor.role)
  )
    throw new Error("Only platform administrators manage staff invitations.");
  await requireOrganizationAccess(actor, invitation.organizationId);
}

export async function listPortalInvitations(
  actor: SessionUser,
  purpose: "staff" | "policyholder",
  organizationId?: string,
): Promise<InvitationSummary[]> {
  if (purpose === "staff" && actor.role !== "admin")
    throw new Error("Staff invitations are restricted to administrators.");
  if (purpose === "policyholder") {
    if (
      !organizationId ||
      !["admin", "head_agent", "agent"].includes(actor.role)
    )
      throw new Error("Select an authorized organization.");
    await requireOrganizationAccess(actor, organizationId);
  }
  const records = await db
    .select({ invitation: invitations, organizationName: organizations.name })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(
      and(
        eq(invitations.purpose, purpose),
        ...(organizationId
          ? [eq(invitations.organizationId, organizationId)]
          : []),
      ),
    )
    .orderBy(desc(invitations.createdAt))
    .limit(100);
  return records.map(({ invitation, organizationName }) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    purpose: invitation.purpose,
    organizationName,
    state: invitationState(invitation),
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    deliveryState: invitation.deliveryState,
    deliveryError: invitation.deliveryError,
    policyType: invitation.enrollmentPolicyType,
    policyNumber: invitation.enrollmentPolicyNumber,
  }));
}

export async function invitationPreview(token: string) {
  if (!isInvitationToken(token)) return null;
  const [record] = await db
    .select({
      invitation: invitations,
      organizationName: organizations.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.token, hashInvitationToken(token)))
    .limit(1);
  if (!record) return null;
  const { invitation, organizationName } = record;
  const inviterName = profileFor(await getActorProfiles([invitation.invitedBy]), invitation.invitedBy).name;
  return {
    email: invitation.email,
    organizationName,
    inviterName,
    role: invitation.role,
    purpose: invitation.purpose,
    name: invitation.enrollmentName,
    state: invitationState(invitation),
    expiresAt: invitation.expiresAt.toISOString(),
    policyType: invitation.enrollmentPolicyType,
    maskedPolicyNumber: invitation.enrollmentPolicyNumber
      ? `…${invitation.enrollmentPolicyNumber.slice(-6)}`
      : null,
    source: invitation.policyProfile?.source,
  };
}
