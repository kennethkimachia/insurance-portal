"use server";
import { actionError } from "@/lib/action-errors";

import { portalActors, policyholderEnrollments } from "@/db/schema";
import { getActorProfiles, profileFor, getActorProfile } from "@/lib/clerk-directory";
import { db } from "@/db";
import {
  claims,
  policies,
  organizations,
  claimAttachments,
  claimEvents,
  claimNotes,
  claimProgressSteps,
  claimNotifications,
  evidenceRequests,
} from "@/db/schema";
import { and, asc, desc, eq, ne, getTableColumns, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import {
  getActiveOrganizationId,
  requireOrganizationAccess,
} from "@/lib/organization-access";
import { CLOSED_CLAIM_STATUSES } from "@/lib/claim-record-policy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getMyPolicies() {
  const session = await requireSession();
  const rows = await db
    .select({
      ...getTableColumns(policies),
      organizationName: organizations.name,
    })
    .from(policies)
    .innerJoin(organizations, eq(organizations.id, policies.organizationId))
    .where(eq(policies.userId, session.id))
    .orderBy(desc(policies.createdAt));
  return rows.map((p) => ({
    ...p,
    policyholderPhone: session.phone,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getPoliciesForClaimForm() {
  const session = await requireSession();
  if (session.role === "user")
    return (await getMyPolicies()).map((p) => ({
      ...p,
      policyholderName: undefined as string | undefined,
    }));
  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) return [];
  await requireOrganizationAccess(session, organizationId);
  const rows = await db
    .select({
      ...getTableColumns(policies),
      organizationName: organizations.name,
      policyholderPhone: policyholderEnrollments.phone,
    })
    .from(policies)
    .innerJoin(organizations, eq(organizations.id, policies.organizationId))
    .leftJoin(policyholderEnrollments, eq(policyholderEnrollments.actorId, policies.userId))
    .where(eq(policies.organizationId, organizationId))
    .orderBy(desc(policies.createdAt));
  const profiles = await getActorProfiles(rows.map((p) => p.userId));
  return rows.map((p) => ({ ...p, policyholderName: profileFor(profiles, p.userId).name, createdAt: p.createdAt.toISOString() }));
}

export async function getMyClaims() {
  const session = await requireSession();
  const rows = await db
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
      openRequestCount: sql<number>`(SELECT count(*)::int FROM evidence_requests er WHERE er.claim_id = ${claims.id} AND er.status <> 'resolved')`,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
      submittedAt: claims.submittedAt,
      withdrawalRequestedAt: claims.withdrawalRequestedAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(eq(policies.userId, session.id))
    .orderBy(desc(claims.updatedAt));
  return rows.map((c) => ({
    ...c,
    openRequestCount: CLOSED_CLAIM_STATUSES.has(c.status)
      ? 0
      : c.openRequestCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    submittedAt: c.submittedAt?.toISOString() ?? null,
    withdrawalRequestedAt: c.withdrawalRequestedAt?.toISOString() ?? null,
  }));
}

export async function getMyDrafts() {
  const session = await requireSession();
  if (session.role === "user")
    return (await getMyClaims()).filter((c) => c.status === "draft");
  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) return [];
  await requireOrganizationAccess(session, organizationId);
  const rows = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      policyId: claims.policyId,
      policyType: policies.policyType,
      policyNumber: policies.policyNumber,
      organizationName: organizations.name,
      updatedAt: claims.updatedAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(
      and(
        eq(claims.organizationId, organizationId),
        eq(claims.createdBy, session.id),
        eq(claims.status, "draft"),
      ),
    )
    .orderBy(desc(claims.updatedAt));
  return rows.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }));
}

export async function getMyClaimDraft(id: string) {
  const session = await requireSession();
  const claim = await requireClaimAccess(session, z.string().uuid().parse(id));
  if (
    claim.policyholderId !== session.id &&
    claim.createdBy !== session.id &&
    session.role !== "admin"
  )
    throw new Error("Draft not found");
  if (claim.status !== "draft")
    throw new Error("This report has already been submitted");
  return {
    id: claim.id,
    claimId: claim.id,
    policyId: claim.policyId,
    policyType: claim.policyType,
    policyNumber: claim.policyNumber,
    organizationName: claim.organizationName,
    claimNumber: claim.claimNumber,
    formData: claim.formData ?? {},
    savedAt: claim.updatedAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

export async function getPotentialDuplicateClaims(
  policyId: string,
  incidentDate: string,
) {
  const session = await requireSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incidentDate)) return [];
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, z.string().uuid().parse(policyId)))
    .limit(1);
  if (!policy) throw new Error("Policy not found or access denied");
  if (session.role === "user") {
    if (policy.userId !== session.id)
      throw new Error("Policy not found or access denied");
  } else await requireOrganizationAccess(session, policy.organizationId);
  return db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
    })
    .from(claims)
    .where(
      and(
        eq(claims.policyId, policyId),
        eq(claims.incidentDate, incidentDate),
        ne(claims.status, "draft"),
      ),
    )
    .limit(5);
}

export async function getMyClaimProgress(id: string) {
  await requireClaimAccess(await requireSession(), z.string().uuid().parse(id));
  const rows = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, id))
    .orderBy(asc(claimProgressSteps.stepOrder));
  return rows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getMyClaimAgent(id: string) {
  const claim = await requireClaimAccess(
    await requireSession(),
    z.string().uuid().parse(id),
  );
  if (!claim.assignedAgentId) return null;
  const [actor] = await db.select().from(portalActors).where(eq(portalActors.id, claim.assignedAgentId)).limit(1);
  const profile = await getActorProfile(claim.assignedAgentId);
  if (!actor || actor.suspendedAt || actor.retiredAt || actor.pendingRoleOperationId || !profile.available || profile.banned || profile.role !== "agent") return null;
  return { id: actor.id, name: profile.name, email: profile.email, phone: profile.phone };
}

export async function getMyNotifications() {
  const session = await requireSession();
  const rows = await db
    .select()
    .from(claimNotifications)
    .where(eq(claimNotifications.userId, session.id))
    .orderBy(desc(claimNotifications.createdAt))
    .limit(100);
  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
}

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await db
    .update(claimNotifications)
    .set({ read: true })
    .where(
      and(
        eq(claimNotifications.id, z.string().uuid().parse(id)),
        eq(claimNotifications.userId, session.id),
      ),
    );
  revalidatePath("/dashboard/user");
  revalidatePath("/notifications");
  return { success: true };
}

export async function getMyClaimAttachments(id: string) {
  await requireClaimAccess(await requireSession(), z.string().uuid().parse(id));
  const rows = await db
    .select()
    .from(claimAttachments)
    .where(eq(claimAttachments.claimId, id))
    .orderBy(desc(claimAttachments.createdAt));
  return rows.map((a) => ({
    id: a.id,
    name: a.originalFilename,
    type: a.contentType,
    size: a.sizeBytes ?? 0,
    category: a.category,
    lossItemId: a.lossItemId,
    clientUploadId: a.clientUploadId,
    uploadState: a.uploadState,
    uploadError: a.uploadError,
    scanState: a.scanState,
    reviewStatus: a.reviewStatus,
    reviewNote: a.reviewNote,
    uploadedAt: a.createdAt.toISOString(),
  }));
}

export async function getClaimWorkspace(id: string) {
  const session = await requireSession();
  const claim = await requireClaimAccess(session, z.string().uuid().parse(id));
  const publicFilter =
    session.role === "user" ? eq(claimEvents.visibility, "public") : undefined;
  const noteFilter =
    session.role === "user" ? eq(claimNotes.visibility, "public") : undefined;
  const [events, notes, requests, documents, progress, agent, similar] =
    await Promise.all([
      db
        .select()
        .from(claimEvents)
        .where(and(eq(claimEvents.claimId, id), publicFilter))
        .orderBy(desc(claimEvents.createdAt)),
      db
        .select({
          id: claimNotes.id,
          content: claimNotes.content,
          visibility: claimNotes.visibility,
          createdAt: claimNotes.createdAt,
          authorId: claimNotes.authorId,
        })
        .from(claimNotes)
        .where(and(eq(claimNotes.claimId, id), noteFilter))
        .orderBy(desc(claimNotes.createdAt)),
      db
        .select()
        .from(evidenceRequests)
        .where(eq(evidenceRequests.claimId, id))
        .orderBy(desc(evidenceRequests.createdAt)),
      getMyClaimAttachments(id),
      getMyClaimProgress(id),
      getMyClaimAgent(id),
      claim.incidentDate
        ? db
            .select({ id: claims.id, claimNumber: claims.claimNumber })
            .from(claims)
            .where(
              and(
                eq(claims.policyId, claim.policyId),
                eq(claims.incidentDate, claim.incidentDate),
                ne(claims.id, id),
                ne(claims.status, "draft"),
              ),
            )
            .limit(5)
        : Promise.resolve([]),
    ]);
  const profiles = await getActorProfiles(notes.map((n) => n.authorId));
  return {
    claim: {
      ...claim,
      assessmentSummary:
        session.role === "user" ? null : claim.assessmentSummary,
      estimatedLossAmount:
        session.role === "user" ? null : claim.estimatedLossAmount,
      assessedBy: session.role === "user" ? null : claim.assessedBy,
      assessedAt:
        session.role === "user"
          ? null
          : (claim.assessedAt?.toISOString() ?? null),
      createdAt: claim.createdAt.toISOString(),
      updatedAt: claim.updatedAt.toISOString(),
      submittedAt: claim.submittedAt?.toISOString() ?? null,
      withdrawalRequestedAt: claim.withdrawalRequestedAt?.toISOString() ?? null,
      settlementRecordedAt: claim.settlementRecordedAt?.toISOString() ?? null,
    },
    events: events
      .filter((e) => e.type !== "note_added")
      .map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    notes: notes.map(({ authorId, ...n }) => ({ ...n, authorName: profileFor(profiles, authorId).name, createdAt: n.createdAt.toISOString() })),
    requests: requests.map((r) => ({
      ...r,
      dueAt: r.dueAt?.toISOString() ?? null,
      responseAt: r.responseAt?.toISOString() ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    documents,
    progress,
    agent,
    similar,
    role: session.role,
  };
}

export async function addClaimAmendment(id: string, content: string) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(
      session,
      z.string().uuid().parse(id),
      "comment",
    );
    if (claim.status === "draft" || CLOSED_CLAIM_STATUSES.has(claim.status))
      throw new Error(
        "This claim cannot receive an amendment. Contact your agent for help.",
      );
    const text = z.string().trim().min(10).max(5000).parse(content);
    await db.transaction(async (tx) => {
      const fresh = await lockClaimForMutation(
        tx,
        session,
        id,
        undefined,
        "comment",
      );
      if (fresh.status === "draft" || CLOSED_CLAIM_STATUSES.has(fresh.status))
        throw new Error("Claim changed. Refresh before adding information.");
      await tx.insert(claimEvents).values({
        claimId: id,
        actorId: session.id,
        type: "amendment",
        content: text,
      });
      await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1`, updatedAt: new Date() })
        .where(eq(claims.id, id));
    });
    revalidatePath(`/claims/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: actionError(e, "Could not add amendment") };
  }
}

export async function requestClaimWithdrawal(id: string, reason: string) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(
      session,
      z.string().uuid().parse(id),
    );
    if (
      claim.policyholderId !== session.id ||
      claim.status === "draft" ||
      CLOSED_CLAIM_STATUSES.has(claim.status)
    )
      throw new Error("This claim cannot be withdrawn");
    const text = z.string().trim().min(10).max(2000).parse(reason);
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, id, claim.version, "comment");
      const [changed] = await tx
        .update(claims)
        .set({
          withdrawalRequestedAt: new Date(),
          withdrawalReason: text,
          version: sql`${claims.version} + 1`,
        })
        .where(and(eq(claims.id, id), eq(claims.version, claim.version)))
        .returning();
      if (!changed) throw new Error("Claim changed. Refresh and retry.");
      await tx.insert(claimEvents).values({
        claimId: id,
        actorId: session.id,
        type: "withdrawal_requested",
        content: `Withdrawal requested: ${text}`,
      });
    });
    revalidatePath(`/claims/${id}`);
    revalidatePath("/dashboard/user");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: actionError(e, "Could not request withdrawal"),
    };
  }
}

export async function deleteMyClaim(id: string) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(
      session,
      z.string().uuid().parse(id),
    );
    if (
      (claim.policyholderId !== session.id && claim.createdBy !== session.id) ||
      claim.status !== "draft"
    )
      throw new Error(
        "Only your drafts can be deleted. Request withdrawal for a submitted claim.",
      );
    await db.transaction(async (tx) => {
      const locked = await lockClaimForMutation(
        tx,
        session,
        id,
        undefined,
        "comment",
      );
      if (!locked || locked.status !== "draft")
        throw new Error("Draft was submitted. Refresh before continuing.");
      // Draft uploads are disallowed by the upload API, so no storage objects are orphaned.
      const [attachment] = await tx
        .select({ id: claimAttachments.id })
        .from(claimAttachments)
        .where(eq(claimAttachments.claimId, id))
        .limit(1);
      if (attachment)
        throw new Error(
          "This legacy draft has stored documents. Ask an administrator to apply the retention procedure.",
        );
      await tx.delete(claims).where(eq(claims.id, id));
    });
    revalidatePath("/dashboard/user");
    revalidatePath("/claim-forms");
    revalidatePath("/claims");
    return { success: true };
  } catch (e) {
    return { success: false, error: actionError(e, "Could not delete draft") };
  }
}
