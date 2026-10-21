"use server";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  claims,
  evidenceRequests,
  claimEvents,
  claimNotifications,
  claimAttachments,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { closedClaimStatuses } from "@/lib/claim-workflow";
import { evidenceCategoryApplies } from "@/lib/claim-evidence";
import { and, eq, desc, sql, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const failure = (error: unknown) => ({
  success: false as const,
  error: actionError(error, "Unable to save this change"),
});
const isOpen = (status: string) =>
  status !== "draft" &&
  !closedClaimStatuses.some((closed) => closed === status);

export async function getEvidenceRequests(claimId: string) {
  await requireClaimAccess(await requireSession(), claimId);
  const rows = await db
    .select()
    .from(evidenceRequests)
    .where(eq(evidenceRequests.claimId, claimId))
    .orderBy(desc(evidenceRequests.createdAt));
  return rows.map((row) => ({
    ...row,
    dueAt: row.dueAt?.toISOString() ?? null,
    responseAt: row.responseAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createEvidenceRequest(
  claimId: string,
  input: { title: string; category: string; message: string; dueAt?: string },
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    if (!isOpen(claim.status) || claim.status === "approved")
      throw new Error("Request evidence before a claim's outcome is recorded");
    const title = input.title.trim();
    const message = input.message.trim();
    if (
      title.length < 3 ||
      title.length > 200 ||
      message.length < 10 ||
      message.length > 4000
    )
      throw new Error(
        "Give a title and clear instructions (10–4,000 characters)",
      );
    if (
      !evidenceCategoryApplies(
        claim.policyType,
        input.category,
        claim.formData?.premisesUse,
      ) ||
      (claim.policyType === "motor" &&
        ((input.category === "driving_license" &&
          claim.formData?.incidentType !== "accident") ||
          (input.category === "repair_estimate" &&
            claim.formData?.incidentType === "theft")))
    )
      throw new Error("Choose a document category relevant to this incident");
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (
      dueAt &&
      (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now())
    )
      throw new Error("Choose a future deadline or leave it blank");
    const request = await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claimId, claim.version);
      const [updated] = await tx
        .update(claims)
        .set({
          status: "awaiting_information",
          version: sql`${claims.version} + 1`,
        })
        .where(and(eq(claims.id, claimId), eq(claims.version, claim.version)))
        .returning({ id: claims.id });
      if (!updated)
        throw new Error("This claim changed. Refresh and try again.");
      const [created] = await tx
        .insert(evidenceRequests)
        .values({
          claimId,
          requestedBy: session.id,
          title,
          category: input.category,
          message,
          dueAt,
        })
        .returning();
      await tx.insert(claimEvents).values({
        claimId,
        actorId: session.id,
        type: "evidence_requested",
        content: `Information requested: ${title}. ${message}`,
        metadata: {
          requestId: created.id,
          category: input.category,
          previousStatus: claim.status,
        },
      });
      await tx.insert(claimNotifications).values({
        claimId,
        userId: claim.policyholderId,
        type: "evidence_request",
        message: `Action required on ${claim.claimNumber}: ${title}.`,
      });
      return created;
    });
    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { success: true as const, requestId: request.id };
  } catch (error) {
    return failure(error);
  }
}

export async function respondToEvidenceRequest(
  requestId: string,
  response: string,
) {
  try {
    const session = await requireSession();
    const [request] = await db
      .select()
      .from(evidenceRequests)
      .where(eq(evidenceRequests.id, requestId))
      .limit(1);
    if (!request) throw new Error("Request not found");
    const claim = await requireClaimAccess(session, request.claimId, "comment");
    if (session.role !== "user" || session.id !== claim.policyholderId)
      throw new Error("Only the policyholder can respond to this request");
    if (!isOpen(claim.status) || request.status === "resolved")
      throw new Error("This request is closed");
    const content = response.trim();
    if (content.length < 2 || content.length > 4000)
      throw new Error("Enter a response between 2 and 4,000 characters");
    await db.transaction(async (tx) => {
      await lockClaimForMutation(
        tx,
        session,
        claim.id,
        claim.version,
        "comment",
      );
      const [updated] = await tx
        .update(evidenceRequests)
        .set({
          status: "responded",
          response: content,
          responseBy: session.id,
          responseAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(evidenceRequests.id, requestId),
            ne(evidenceRequests.status, "resolved"),
          ),
        )
        .returning({ id: evidenceRequests.id });
      if (!updated)
        throw new Error(
          "This request has been closed. Refresh before responding.",
        );
      await tx.insert(claimEvents).values({
        claimId: claim.id,
        actorId: session.id,
        type: "evidence_response",
        content: `Response to ${request.title}: ${content}`,
        metadata: { requestId },
      });
      if (claim.assignedAgentId)
        await tx.insert(claimNotifications).values({
          claimId: claim.id,
          userId: claim.assignedAgentId,
          type: "evidence_response",
          message: `A response to ${request.title} is available on ${claim.claimNumber}.`,
        });
    });
    revalidatePath(`/claims/${claim.id}`);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function resolveEvidenceRequest(
  requestId: string,
  resolution: string,
) {
  try {
    const session = await requireSession();
    const [request] = await db
      .select()
      .from(evidenceRequests)
      .where(eq(evidenceRequests.id, requestId))
      .limit(1);
    if (!request) throw new Error("Request not found");
    const claim = await requireClaimAccess(session, request.claimId, "manage");
    if (!isOpen(claim.status) || request.status === "resolved")
      throw new Error("This request is already closed");
    const content = resolution.trim();
    if (content.length < 5 || content.length > 2000)
      throw new Error(
        "Record why this request is complete (5–2,000 characters)",
      );
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claim.id, claim.version);
      const [updated] = await tx
        .update(evidenceRequests)
        .set({
          status: "resolved",
          resolvedBy: session.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(evidenceRequests.id, requestId),
            ne(evidenceRequests.status, "resolved"),
          ),
        )
        .returning({ id: evidenceRequests.id });
      if (!updated) throw new Error("This request was already resolved");
      const [remaining] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(evidenceRequests)
        .where(
          and(
            eq(evidenceRequests.claimId, claim.id),
            ne(evidenceRequests.status, "resolved"),
          ),
        );
      if (remaining.count === 0)
        await tx
          .update(claims)
          .set({ status: "under_review", version: sql`${claims.version} + 1` })
          .where(
            and(
              eq(claims.id, claim.id),
              eq(claims.status, "awaiting_information"),
            ),
          );
      await tx.insert(claimEvents).values({
        claimId: claim.id,
        actorId: session.id,
        type: "evidence_resolved",
        content: `Information request completed: ${request.title}. ${content}`,
        metadata: { requestId, resolution: content },
      });
      await tx.insert(claimNotifications).values({
        claimId: claim.id,
        userId: claim.policyholderId,
        type: "evidence_resolved",
        message: `${request.title} is complete for ${claim.claimNumber}.${remaining.count === 0 ? " Your claim is now under review." : ""}`,
      });
    });
    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewClaimAttachment(
  attachmentId: string,
  input: { status: "accepted" | "needs_replacement" | "waived"; note: string },
) {
  try {
    const session = await requireSession();
    const [attachment] = await db
      .select()
      .from(claimAttachments)
      .where(eq(claimAttachments.id, attachmentId))
      .limit(1);
    if (!attachment) throw new Error("Document not found");
    const claim = await requireClaimAccess(
      session,
      attachment.claimId,
      "manage",
    );
    if (!isOpen(claim.status))
      throw new Error("Review documents on an open submitted claim");
    if (claim.status === "approved")
      throw new Error(
        "Reopen the review before changing documents on an approved claim",
      );
    const note = input.note.trim();
    if (
      !["accepted", "needs_replacement", "waived"].includes(input.status) ||
      note.length < 5 ||
      note.length > 2000
    )
      throw new Error(
        "Record the inspection result or waiver and a reason (5–2,000 characters)",
      );
    if (input.status !== "waived" && attachment.uploadState !== "ready")
      throw new Error(
        "Retry or explicitly waive an incomplete upload before inspecting it",
      );
    if (attachment.uploadState === "uploading")
      throw new Error(
        "Wait for the upload to finish or fail before reviewing or waiving it",
      );
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claim.id, claim.version);
      const [freshAttachment] = await tx
        .select()
        .from(claimAttachments)
        .where(eq(claimAttachments.id, attachmentId))
        .for("update")
        .limit(1);
      if (
        !freshAttachment ||
        freshAttachment.uploadState === "uploading" ||
        (input.status !== "waived" && freshAttachment.uploadState !== "ready")
      )
        throw new Error("This upload changed. Refresh before inspecting it.");
      await tx
        .update(claimAttachments)
        .set({
          reviewStatus: input.status,
          reviewNote: note,
          reviewedBy: session.id,
          reviewedAt: new Date(),
          scanState: input.status === "accepted" ? "clean" : "rejected",
        })
        .where(eq(claimAttachments.id, attachmentId));
      await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1` })
        .where(eq(claims.id, claim.id));
      await tx.insert(claimEvents).values({
        claimId: claim.id,
        actorId: session.id,
        type: "document_reviewed",
        content: `${attachment.originalFilename}: ${input.status === "accepted" ? "accepted after manual inspection" : input.status === "waived" ? "requirement waived with a recorded reason" : "replacement requested"}. ${note}`,
        metadata: {
          attachmentId,
          reviewStatus: input.status,
          inspection: "manual",
        },
      });
      await tx.insert(claimNotifications).values({
        claimId: claim.id,
        userId: claim.policyholderId,
        type: "document_review",
        message: `${attachment.originalFilename} ${input.status === "accepted" ? "was accepted" : input.status === "waived" ? "was waived" : "needs replacement"} for ${claim.claimNumber}.`,
      });
    });
    revalidatePath(`/claims/${claim.id}`);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function recordCarrierHandoff(
  claimId: string,
  input: { state: "manual" | "simulated"; reference: string; reason: string },
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    if (!isOpen(claim.status))
      throw new Error("Record carrier handoff on an open submitted claim");
    const reference = input.reference.trim();
    const reason = input.reason.trim();
    if (
      !["manual", "simulated"].includes(input.state) ||
      reference.length < 3 ||
      reference.length > 100 ||
      reason.length < 10 ||
      reason.length > 2000
    )
      throw new Error(
        "Choose a source, reference (3–100 characters), and explanation (10–2,000 characters)",
      );
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claimId, claim.version);
      const [updated] = await tx
        .update(claims)
        .set({
          carrierHandoffState: input.state,
          carrierReference: reference,
          version: sql`${claims.version} + 1`,
        })
        .where(and(eq(claims.id, claimId), eq(claims.version, claim.version)))
        .returning({ id: claims.id });
      if (!updated)
        throw new Error("This claim changed. Refresh and try again.");
      await tx.insert(claimEvents).values({
        claimId,
        actorId: session.id,
        type: "carrier_handoff_recorded",
        content: `${input.state === "simulated" ? "Simulated" : "Manually recorded"} carrier handoff. Reference: ${reference}. ${reason}`,
        metadata: { source: input.state, reference },
      });
      await tx.insert(claimNotifications).values({
        claimId,
        userId: claim.policyholderId,
        type: "carrier_handoff",
        message: `${input.state === "simulated" ? "A simulated" : "A manual"} carrier handoff was recorded for ${claim.claimNumber}. Reference: ${reference}.`,
      });
    });
    revalidatePath(`/claims/${claimId}`);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
