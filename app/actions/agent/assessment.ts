"use server";

import { actionError } from "@/lib/action-errors";
import { db } from "@/db";
import { claims, claimEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { z } from "zod";
import { revalidatePath } from "next/cache";
const schema = z.object({
  summary: z.string().trim().min(20).max(5000),
  estimatedLossAmount: z
    .string()
    .trim()
    .regex(/^(?:|\d{1,12}(?:\.\d{1,2})?)$/)
    .refine(
      (v) => v === "" || Number(v) > 0,
      "Use a positive KES estimate or leave it unknown",
    )
    .default(""),
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
      await lockClaimForMutation(tx, session, claimId, claim.version);
      const [updated] = await tx
        .update(claims)
        .set({
          assessmentSummary: data.summary,
          estimatedLossAmount: data.estimatedLossAmount || null,
          assessedBy: session.id,
          assessedAt: new Date(),
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
            estimatedLossAmount: data.estimatedLossAmount || null,
            previousSummary: claim.assessmentSummary,
          },
        });
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
