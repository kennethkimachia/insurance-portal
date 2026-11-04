"use server";

import { actionError } from "@/lib/action-errors";
import { db } from "@/db";
import { claims, claimEvents, claimAttachments, evidenceRequests, claimNotifications, claimProgressSteps } from "@/db/schema";
import { and, eq, sql, ne, notInArray, or } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { validateClaimReadiness } from "@/lib/claim-workflow";
const schema = z.object({
  summary: z.string().trim().min(20).max(5000),
  completeReview: z.boolean().default(false),

});

export async function recordClaimAssessment(
  claimId: string,
  input: z.input<typeof schema>,
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(
      session,
      z.string().uuid().parse(claimId),
      "manage",
    );
    if (
      ![
        "assigned",
        "surveyor_dispatched",
        "under_review",
        "awaiting_information",
      ].includes(claim.status)
    )
      throw new Error(
        "Record an assessment before completing the review stage",
      );
    const data = schema.parse(input);
    await db.transaction(async (tx) => {
      const fresh = await lockClaimForMutation(tx, session, claimId, claim.version);
      if (!["assigned", "surveyor_dispatched", "under_review", "awaiting_information"].includes(fresh.status)) throw new Error("Reopen the review before changing its assessment.");
      if (data.completeReview) {
        const [[requests], [documents], [work]] = await Promise.all([
          tx.select({ count: sql<number>`count(*)::int` }).from(evidenceRequests).where(and(eq(evidenceRequests.claimId, claimId), ne(evidenceRequests.status, "resolved"))),
          tx.select({ count: sql<number>`count(*)::int` }).from(claimAttachments).where(and(eq(claimAttachments.claimId, claimId), or(eq(claimAttachments.uploadState, "uploading"), notInArray(claimAttachments.reviewStatus, ["accepted", "waived"])))),
          tx.select({ count: sql<number>`count(*)::int` }).from(claimProgressSteps).where(and(eq(claimProgressSteps.claimId, claimId), eq(claimProgressSteps.isSystem, false), eq(claimProgressSteps.isCompleted, false))),
        ]);
        const error = validateClaimReadiness("assessment_complete", { assessmentSummary: data.summary, openEvidenceRequests: requests.count, unreviewedDocuments: documents.count, openWorkItems: work.count });
        if (error) throw new Error(error);
      }
      const [updated] = await tx
        .update(claims)
        .set({
          assessmentSummary: data.summary,
          assessedBy: session.id,
          assessedAt: new Date(),
          ...(data.completeReview ? { status: "assessment_complete" as const } : {}),
          version: sql`${claims.version} + 1`,
        })
        .where(and(eq(claims.id, claimId), eq(claims.version, claim.version)))
        .returning();
      if (!updated)
        throw new Error("Claim changed. Refresh before saving the assessment.");
      await tx
        .insert(claimEvents)
        .values({
          claimId,
          actorId: session.id,
          type: "assessment_recorded",
          visibility: "internal",
          content: data.summary,
          metadata: {
            estimatedLossAmount: fresh.estimatedLossAmount,
            previousSummary: claim.assessmentSummary,
          },
        });
      if (data.completeReview) {
        await tx.insert(claimEvents).values({ claimId, actorId: session.id, type: "assessment_submitted", visibility: "public", content: "The evidence review is complete. Assessment findings have been submitted for a claims manager’s decision.", metadata: { from: fresh.status, to: "assessment_complete" } });
        await tx.insert(claimNotifications).values({ claimId, userId: claim.policyholderId, type: "status_change", message: `${claim.claimNumber}: review complete; awaiting a claims manager’s decision.` });
      }
    });
    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, "Could not save assessment"),
    };
  }
}
