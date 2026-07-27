"use server";

import { db } from "@/db";
import {
  claims,
  policies,
  claimProgressSteps,
  claimNotifications,
  claimNotes,
  claimAttachments,
  motorClaimDetails,
  burglaryClaimDetails,
  burglaryLossItems,
  user,
  organizations,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, desc, asc } from "drizzle-orm";

// ── Get my policies ────────────────────────────────────────────────────

export async function getMyPolicies() {
  const session = await requireSession();

  const result = await db
    .select({
      id: policies.id,
      policyNumber: policies.policyNumber,
      policyType: policies.policyType,
      organizationId: policies.organizationId,
      organizationName: organizations.name,
      createdAt: policies.createdAt,
    })
    .from(policies)
    .innerJoin(organizations, eq(organizations.id, policies.organizationId))
    .where(eq(policies.userId, session.id))
    .orderBy(desc(policies.createdAt));

  return result.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));
}

// ── Get my claims ──────────────────────────────────────────────────────

export async function getMyClaims() {
  const session = await requireSession();

  const result = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      policyId: claims.policyId,
      policyNumber: policies.policyNumber,
      policyType: policies.policyType,
      organizationId: claims.organizationId,
      organizationName: organizations.name,
      assignedAgentId: claims.assignedAgentId,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(eq(policies.userId, session.id))
    .orderBy(desc(claims.createdAt));

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

// ── Get claim progress steps ───────────────────────────────────────────

export async function getMyClaimProgress(claimId: string) {
  const session = await requireSession();

  // Verify this is the user's claim
  const [claim] = await db
    .select({ id: claims.id, policyId: claims.policyId })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return [];

  const [policy] = await db
    .select({ userId: policies.userId })
    .from(policies)
    .where(eq(policies.id, claim.policyId))
    .limit(1);

  if (!policy || policy.userId !== session.id) return [];

  const steps = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, claimId))
    .orderBy(asc(claimProgressSteps.stepOrder));

  return steps.map((s) => ({
    ...s,
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));
}

// ── Get agent contact info ─────────────────────────────────────────────

export async function getMyClaimAgent(claimId: string) {
  const session = await requireSession();

  const [claim] = await db
    .select({
      assignedAgentId: claims.assignedAgentId,
      policyId: claims.policyId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim?.assignedAgentId) return null;

  // Verify ownership
  const [policy] = await db
    .select({ userId: policies.userId })
    .from(policies)
    .where(eq(policies.id, claim.policyId))
    .limit(1);

  if (!policy || policy.userId !== session.id) return null;

  const [agent] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, claim.assignedAgentId))
    .limit(1);

  return agent || null;
}

// ── Get my notifications ──────────────────────────────────────────────

export async function getMyNotifications() {
  const session = await requireSession();

  const result = await db
    .select()
    .from(claimNotifications)
    .where(eq(claimNotifications.userId, session.id))
    .orderBy(desc(claimNotifications.createdAt))
    .limit(20);

  return result.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));
}

// ── Get my claim attachments ──────────────────────────────────────────

export async function getMyClaimAttachments(claimId: string) {
  const session = await requireSession();

  // Verify ownership
  const [claim] = await db
    .select({ policyId: claims.policyId })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return [];

  const [policy] = await db
    .select({ userId: policies.userId })
    .from(policies)
    .where(eq(policies.id, claim.policyId))
    .limit(1);

  if (!policy || policy.userId !== session.id) return [];

  const attachments = await db
    .select()
    .from(claimAttachments)
    .where(eq(claimAttachments.claimId, claimId))
    .orderBy(desc(claimAttachments.createdAt));

  return attachments.map((a) => ({
    id: a.id,
    name: a.originalFilename,
    type: a.contentType,
    size: a.sizeBytes ?? 0,
    uploadedAt: a.createdAt.toISOString(),
  }));
}
export async function deleteMyClaim(claimId: string) {
  const session = await requireSession();

  const [claim] = await db
    .select({
      id: claims.id,
      status: claims.status,
      policyId: claims.policyId,
      policyholderId: policies.userId,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return { success: false, error: "Claim not found" };
  if (claim.policyholderId !== session.id) {
    return { success: false, error: "This claim does not belong to you" };
  }
  if (["approved", "settled"].includes(claim.status)) {
    return { success: false, error: "Approved or settled claims cannot be deleted" };
  }

  const burglaryDetails = await db
    .select({ id: burglaryClaimDetails.id })
    .from(burglaryClaimDetails)
    .where(eq(burglaryClaimDetails.claimId, claim.id));

  for (const detail of burglaryDetails) {
    await db
      .delete(burglaryLossItems)
      .where(eq(burglaryLossItems.burglaryDetailId, detail.id));
  }

  await db.delete(claimAttachments).where(eq(claimAttachments.claimId, claim.id));
  await db.delete(claimNotifications).where(eq(claimNotifications.claimId, claim.id));
  await db.delete(claimNotes).where(eq(claimNotes.claimId, claim.id));
  await db.delete(claimProgressSteps).where(eq(claimProgressSteps.claimId, claim.id));
  await db.delete(motorClaimDetails).where(eq(motorClaimDetails.claimId, claim.id));
  await db.delete(burglaryClaimDetails).where(eq(burglaryClaimDetails.claimId, claim.id));
  await db.delete(claims).where(eq(claims.id, claim.id));

  return { success: true };
}