import { findClerkProfileByEmail, getActorProfiles, profileFor } from "@/lib/clerk-directory";
import { db } from "@/db";
import {
  invitations,
  organizations,
  portalActors,
  policyholderEnrollments,
  policies,
  auditEvents,
  agentOrganizations,
} from "@/db/schema";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { sendClerkInvitation, revokeClerkInvitation } from "@/lib/clerk-invitation-policy";
import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_LIFETIME_MS,
  invitationState,
  isInvitationToken,
  normalizeEmail,
  invitationConflict,
  createPortalPolicyNumber,
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
  lastSentAt: string | null;
  acceptedAt: string | null;
};

export async function deliverInvitation(invitation: Invitation, token: string) {
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(invitations)
      .where(and(eq(invitations.id, invitation.id), eq(invitations.token, hashInvitationToken(token))))
      .for("update");
    if (!record || invitationState(record) !== "pending")
      throw new Error("This invitation changed. Refresh the invitations list.");
    let clerkInvitationId = record.clerkInvitationId;
    let deliveryState: "sent" | "failed" = "failed";
    let deliveryError: string | null = null;
    try {
      const client = (await clerkClient()).invitations;
      await revokeClerkInvitation(client, clerkInvitationId);
      const created = await sendClerkInvitation(client, {
        id: record.id, email: record.email, token, expiresAt: record.expiresAt,
        baseURL: process.env.NEXT_PUBLIC_APP_URL,
      });
      clerkInvitationId = created.id;
      deliveryState = "sent";
    } catch {
      deliveryError = "Clerk could not send this invitation. Check the Clerk email and instance configuration, then retry delivery.";
    }
    await tx.update(invitations).set({ clerkInvitationId, deliveryState, deliveryError, lastSentAt: new Date() })
      .where(eq(invitations.id, record.id));
    return {
      deliveryState,
      message: deliveryState === "sent"
        ? "Invitation email requested."
        : `Invitation saved. ${deliveryError}`,
    };
  });
}

type InvitationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call while holding the email advisory lock and organization row lock. */
export async function assertInvitationReservations(tx: InvitationTransaction, input: {
  email: string; role: Role; purpose: "staff" | "policyholder"; organizationId: string;
  enrollmentPolicyType?: string | null; policyProfile?: Invitation["policyProfile"];
}, excludeId?: string) {
  const activeInvitations = await tx.select().from(invitations).where(and(
    eq(invitations.email, input.email),
    eq(invitations.status, "pending"),
    isNull(invitations.revokedAt),
    gt(invitations.expiresAt, new Date()),
    excludeId ? ne(invitations.id, excludeId) : undefined,
  ));
  if (activeInvitations.some((record) => invitationConflict(record, input)))
    throw new Error("An active or conflicting invitation already exists for this email. Review, resend or revoke it before creating another.");
  if (input.policyProfile?.source === "manual" && input.policyProfile.insurerReference) {
    const reference = input.policyProfile.insurerReference;
    const [policy] = await tx.select({ id: policies.id }).from(policies).where(and(
      eq(policies.organizationId, input.organizationId),
      sql`lower(trim(${policies.insurerReference})) = lower(trim(${reference}))`,
    )).limit(1);
    const [reserved] = await tx.select({ id: invitations.id }).from(invitations).where(and(
      eq(invitations.organizationId, input.organizationId),
      eq(invitations.purpose, "policyholder"),
      eq(invitations.status, "pending"),
      isNull(invitations.revokedAt),
      gt(invitations.expiresAt, new Date()),
      excludeId ? ne(invitations.id, excludeId) : undefined,
      sql`lower(trim(${invitations.policyProfile}->>'insurerReference')) = lower(trim(${reference}))`,
    )).limit(1);
    if (policy || reserved)
      throw new Error("This insurer policy reference is already recorded or reserved by an active invitation. Review the existing record.");
  }
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
    if (input.purpose === "staff" && (input.actor.role !== "admin" || input.role === "user"))
      throw new Error("Only administrators can invite staff.");
    if (input.purpose === "policyholder" && !["admin", "head_agent", "agent"].includes(input.actor.role))
      throw new Error("Only authorized staff can invite policyholders.");
    if (input.actor.role !== "admin") {
      const [membership] = await tx.select({ id: agentOrganizations.id }).from(agentOrganizations)
        .where(and(eq(agentOrganizations.agentId, input.actor.id), eq(agentOrganizations.organizationId, input.organizationId))).for("share");
      if (!membership) throw new Error("You do not have access to this organization.");
    }
    if (input.purpose === "policyholder" && (!input.enrollmentPolicyType || !input.policyProfile))
      throw new Error("Choose a policy type before sending the invitation.");
    // Serialize conflicting roles and organizations for the same invited identity.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invitation:${email}`}, 0))`);
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
    await assertInvitationReservations(tx, { ...input, email });
    const policyNumber = input.enrollmentPolicyType
      ? createPortalPolicyNumber(input.policyProfile!.source, input.enrollmentPolicyType)
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
    lastSentAt: invitation.lastSentAt?.toISOString() ?? null,
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
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
    insurerReference: invitation.policyProfile?.insurerReference,
    insuredAsset: invitation.policyProfile?.insuredAsset,
    coverageStart: invitation.policyProfile?.coverageStart,
    coverageEnd: invitation.policyProfile?.coverageEnd,
    coverageSummary: invitation.policyProfile?.coverageSummary,
  };
}
