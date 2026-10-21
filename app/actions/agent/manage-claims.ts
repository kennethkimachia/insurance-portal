"use server";

import { actionError } from "@/lib/action-errors";

import { getActorProfiles, profileFor } from "@/lib/clerk-directory";
import { db } from "@/db";
import {
  claims,
  policies,
  claimNotes,
  claimNotifications,
  claimAttachments,
  motorClaimDetails,
  burglaryClaimDetails,
  burglaryLossItems,
  organizations,
  claimEvents,
  claimProgressSteps,
  evidenceRequests,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, desc, asc, sql, ne, notInArray, or } from "drizzle-orm";
import {
  getActiveOrganizationId,
  requireOrganizationAccess,
} from "@/lib/organization-access";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import {
  statusLabels,
  validateStatusTransition,
  validateClaimReadiness,
  isClaimStatus,
  closedClaimStatuses,
  type ClaimStatus,
} from "@/lib/claim-workflow";
import { revalidatePath } from "next/cache";

export async function getMyAssignedClaims() {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_UPDATE_STATUS);
  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) return [];
  await requireOrganizationAccess(session, organizationId);
  const result = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      openRequestCount: sql<number>`(SELECT count(*)::int FROM evidence_requests er WHERE er.claim_id = ${claims.id} AND er.status <> 'resolved')`,
      overdueRequestCount: sql<number>`(SELECT count(*)::int FROM evidence_requests er WHERE er.claim_id = ${claims.id} AND er.status <> 'resolved' AND er.due_at < now())`,
      description: claims.description,
      policyType: policies.policyType,
      policyholderId: policies.userId,
      organizationName: organizations.name,
      organizationId: claims.organizationId,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(
      and(
        eq(claims.assignedAgentId, session.id),
        eq(claims.organizationId, organizationId),
      ),
    )
    .orderBy(desc(claims.createdAt));
  const profiles = await getActorProfiles(result.map((c) => c.policyholderId));
  return result.map((claim) => ({
    policyholderName: profileFor(profiles, claim.policyholderId).name,
    ...claim,
    openRequestCount: closedClaimStatuses.includes(claim.status)
      ? 0
      : claim.openRequestCount,
    overdueRequestCount: closedClaimStatuses.includes(claim.status)
      ? 0
      : claim.overdueRequestCount,
    createdAt: claim.createdAt.toISOString(),
  }));
}

export async function getClaimDetails(claimId: string) {
  const session = await requireSession();
  const claim = await requireClaimAccess(session, claimId);
  const [attachments, motorRows, burglaryRows] = await Promise.all([
    db
      .select()
      .from(claimAttachments)
      .where(eq(claimAttachments.claimId, claimId))
      .orderBy(desc(claimAttachments.createdAt)),
    claim.policyType === "motor"
      ? db
          .select()
          .from(motorClaimDetails)
          .where(eq(motorClaimDetails.claimId, claimId))
          .limit(1)
      : Promise.resolve([]),
    claim.policyType === "burglary"
      ? db
          .select()
          .from(burglaryClaimDetails)
          .where(eq(burglaryClaimDetails.claimId, claimId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const motorDetails = motorRows[0];
  const burglaryDetails = burglaryRows[0];
  const lossItems = burglaryDetails
    ? await db
        .select({
          id: burglaryLossItems.id,
          description: burglaryLossItems.description,
          purchaseDate: burglaryLossItems.purchaseDate,
          originalCost: burglaryLossItems.originalCost,
          replacementValue: burglaryLossItems.replacementValue,
        })
        .from(burglaryLossItems)
        .where(eq(burglaryLossItems.burglaryDetailId, burglaryDetails.id))
    : [];
  return {
    ...claim,
    assessmentSummary: session.role === "user" ? null : claim.assessmentSummary,
    estimatedLossAmount:
      session.role === "user" ? null : claim.estimatedLossAmount,
    assessedBy: session.role === "user" ? null : claim.assessedBy,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    submittedAt: claim.submittedAt?.toISOString() ?? null,
    settlementRecordedAt: claim.settlementRecordedAt?.toISOString() ?? null,
    withdrawalRequestedAt: claim.withdrawalRequestedAt?.toISOString() ?? null,
    assessedAt:
      session.role === "user"
        ? null
        : (claim.assessedAt?.toISOString() ?? null),
    motorDetails: motorDetails
      ? { ...motorDetails, createdAt: motorDetails.createdAt.toISOString() }
      : null,
    burglaryDetails: burglaryDetails
      ? {
          ...burglaryDetails,
          lossItems,
          createdAt: burglaryDetails.createdAt.toISOString(),
        }
      : null,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      originalFilename: attachment.originalFilename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes ?? 0,
      category: attachment.category,
      lossItemId: attachment.lossItemId,
      uploadState: attachment.uploadState,
      uploadError: attachment.uploadError,
      scanState: attachment.scanState,
      reviewStatus: attachment.reviewStatus,
      reviewNote: attachment.reviewNote,
      createdAt: attachment.createdAt.toISOString(),
    })),
  };
}

export interface OutcomeDetails {
  source?: "manual" | "simulated";
  settlementAmount?: string;
  settlementReference?: string;
  carrierReference?: string;
}

export async function updateClaimStatus(
  claimId: string,
  newStatus: ClaimStatus,
  reason?: string,
  details?: OutcomeDetails,
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    const error = validateStatusTransition(
      claim.status,
      newStatus,
      session.role,
      reason,
    );
    if (error || !isClaimStatus(newStatus))
      return { success: false, error: error ?? "Invalid claim status" };
    const outcome = ["approved", "rejected", "withdrawn", "settled"].includes(
      newStatus,
    );
    if (
      outcome &&
      (!details?.source || !["manual", "simulated"].includes(details.source))
    )
      return {
        success: false,
        error: "Choose a manual or simulated outcome source",
      };
    const settlementAmount = details?.settlementAmount?.trim();
    const reference = details?.settlementReference?.trim();
    if (
      newStatus === "settled" &&
      (!settlementAmount ||
        !/^\d{1,12}(?:\.\d{1,2})?$/.test(settlementAmount) ||
        Number(settlementAmount) <= 0 ||
        !reference ||
        reference.length < 3 ||
        reference.length > 100)
    ) {
      return {
        success: false,
        error:
          "Record a positive settlement amount and a payment or simulation reference",
      };
    }
    const message = `Claim ${claim.claimNumber}: ${statusLabels[newStatus]}.${reason?.trim() ? ` ${reason.trim()}` : ""}${outcome ? ` (${details?.source === "simulated" ? "Simulated outcome" : "Manually recorded outcome"})` : ""}`;
    await db.transaction(async (tx) => {
      const fresh = await lockClaimForMutation(
        tx,
        session,
        claimId,
        claim.version,
      );
      const [[requests], [documents]] = await Promise.all([
        tx
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(evidenceRequests)
          .where(
            and(
              eq(evidenceRequests.claimId, claimId),
              ne(evidenceRequests.status, "resolved"),
            ),
          ),
        tx
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(claimAttachments)
          .where(
            and(
              eq(claimAttachments.claimId, claimId),
              or(
                eq(claimAttachments.uploadState, "uploading"),
                notInArray(claimAttachments.reviewStatus, [
                  "accepted",
                  "waived",
                ]),
              ),
            ),
          ),
      ]);
      const readinessError = validateClaimReadiness(newStatus, {
        assessmentSummary: fresh.assessmentSummary,
        openEvidenceRequests: requests.count,
        unreviewedDocuments: documents.count,
      });
      if (readinessError) throw new Error(readinessError);
      const [updated] = await tx
        .update(claims)
        .set({
          status: newStatus,
          version: sql`${claims.version} + 1`,
          ...(outcome
            ? { outcomeReason: reason!.trim(), outcomeSource: details!.source }
            : {}),
          ...(newStatus === "under_review" &&
          [...closedClaimStatuses, "approved"].includes(claim.status)
            ? {
                outcomeReason: null,
                outcomeSource: null,
                withdrawalRequestedAt: null,
                withdrawalReason: null,
              }
            : {}),
          ...(newStatus === "settled"
            ? {
                settlementAmount,
                settlementReference: reference,
                settlementRecordedAt: new Date(),
              }
            : {}),
          ...(details?.carrierReference?.trim()
            ? {
                carrierReference: details.carrierReference.trim().slice(0, 100),
              }
            : {}),
        })
        .where(
          and(
            eq(claims.id, claimId),
            eq(claims.version, claim.version),
            eq(claims.status, claim.status),
          ),
        )
        .returning({ id: claims.id });
      if (!updated)
        throw new Error(
          "This claim changed. Refresh before updating its status.",
        );
      await tx
        .update(claimProgressSteps)
        .set({
          isCompleted: outcome,
          completedAt: outcome ? new Date() : null,
          completedBy: outcome ? session.id : null,
        })
        .where(
          and(
            eq(claimProgressSteps.claimId, claimId),
            eq(claimProgressSteps.isSystem, true),
            eq(claimProgressSteps.label, "Outcome recorded"),
          ),
        );
      await tx.insert(claimEvents).values({
        claimId,
        actorId: session.id,
        type: "status_changed",
        visibility: "public",
        content: message,
        metadata: {
          from: claim.status,
          to: newStatus,
          reason: reason?.trim(),
          source: details?.source,
        },
      });
      await tx.insert(claimNotifications).values({
        claimId,
        userId: claim.policyholderId,
        type: "status_change",
        message,
      });
    });
    revalidatePath("/claims");
    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, "Unable to update the claim"),
    };
  }
}

export async function addClaimNote(
  claimId: string,
  content: string,
  visibility: "public" | "internal" = "public",
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "comment");
    const cleanContent = content.trim();
    if (cleanContent.length < 2 || cleanContent.length > 4000)
      return {
        success: false,
        error: "Enter a message between 2 and 4,000 characters",
      };
    if (
      !["public", "internal"].includes(visibility) ||
      (session.role === "user" && visibility !== "public")
    )
      return { success: false, error: "Invalid message visibility" };
    if (claim.status === "draft" || closedClaimStatuses.includes(claim.status))
      return {
        success: false,
        error: "Messages are available on open submitted claims",
      };
    const note = await db.transaction(async (tx) => {
      await lockClaimForMutation(
        tx,
        session,
        claimId,
        claim.version,
        "comment",
      );
      const [created] = await tx
        .insert(claimNotes)
        .values({
          claimId,
          authorId: session.id,
          content: cleanContent,
          visibility,
        })
        .returning();
      await tx.insert(claimEvents).values({
        claimId,
        actorId: session.id,
        type: "note_added",
        visibility,
        content: cleanContent,
        metadata: { noteId: created.id },
      });
      if (visibility === "public") {
        const recipient =
          session.role === "user"
            ? claim.assignedAgentId
            : claim.policyholderId;
        if (recipient)
          await tx.insert(claimNotifications).values({
            claimId,
            userId: recipient,
            type: "note_added",
            message: `A new message is available on claim ${claim.claimNumber}.`,
          });
      }
      return created;
    });
    revalidatePath(`/claims/${claimId}`);
    return {
      success: true,
      note: {
        id: note.id,
        author: session.name,
        role: session.role,
        content: note.content,
        visibility: note.visibility,
        createdAt: note.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, "Unable to post the message"),
    };
  }
}

export async function getClaimTimeline(claimId: string) {
  const session = await requireSession();
  await requireClaimAccess(session, claimId);
  const notes = await db
    .select({
      id: claimNotes.id,
      content: claimNotes.content,
      authorId: claimNotes.authorId,
      visibility: claimNotes.visibility,
      createdAt: claimNotes.createdAt,
    })
    .from(claimNotes)
    .where(
      and(
        eq(claimNotes.claimId, claimId),
        session.role === "user"
          ? eq(claimNotes.visibility, "public")
          : undefined,
      ),
    )
    .orderBy(asc(claimNotes.createdAt));
  const events = await db
    .select({
      id: claimEvents.id,
      content: claimEvents.content,
      authorId: claimEvents.actorId,
      visibility: claimEvents.visibility,
      createdAt: claimEvents.createdAt,
    })
    .from(claimEvents)
    .where(
      and(
        eq(claimEvents.claimId, claimId),
        sql`${claimEvents.type} <> 'note_added'`,
        session.role === "user"
          ? eq(claimEvents.visibility, "public")
          : undefined,
      ),
    );
  const profiles = await getActorProfiles([...notes, ...events].map((e) => e.authorId));
  return [...notes, ...events]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((entry) => ({
      id: entry.id,
      author: entry.authorId ? profileFor(profiles, entry.authorId).name : "Portal",
      role: entry.authorId ? profileFor(profiles, entry.authorId).role ?? "unknown" : "system",
      content: entry.content,
      visibility: entry.visibility,
      createdAt: entry.createdAt.toISOString(),
    }));
}
