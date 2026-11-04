"use server";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { claimAttachments, claimEvents, claims } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { getClaimStorage } from "@/lib/storage";
import { actionError } from "@/lib/action-errors";
import { isInterruptedUpload } from "@/lib/evidence-presentation";

/** Recover an object that was stored before an upload's final DB update failed. */
export async function recoverClaimUpload(claimId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(claimId);
    z.string().uuid().parse(attachmentId);
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "upload");
    const [attachment] = await db.select().from(claimAttachments).where(and(eq(claimAttachments.id, attachmentId), eq(claimAttachments.claimId, claimId))).limit(1);
    if (!attachment) throw new Error("Document not found or access denied");
    if (attachment.uploadState === "ready") return { success: true };
    if (attachment.uploadState !== "failed" && !isInterruptedUpload({ ...attachment, updatedAt: attachment.updatedAt.toISOString() }))
      throw new Error("This upload is still running. Wait a few minutes before checking again.");
    if (!attachment.storageKey.startsWith(`${claim.organizationId}/claims/${claimId}/`) || !attachment.contentSha256)
      throw new Error("This older upload cannot be verified. Select the original file and retry.");
    const { s3, bucket } = getClaimStorage();
    let stored;
    try {
      stored = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: attachment.storageKey }));
    } catch {
      throw new Error("Could not verify the stored file. Retry this check, or select the original file under Add documents to upload it again.");
    }
    if (stored.ContentLength !== attachment.sizeBytes || stored.Metadata?.sha256 !== attachment.contentSha256)
      throw new Error("The stored file could not be matched to this upload. Select the original file under Add documents and retry.");
    await db.transaction(async (tx) => {
      const current = await lockClaimForMutation(tx, session, claimId, undefined, "upload");
      if (["draft", "approved", "settled", "rejected", "withdrawn"].includes(current.status))
        throw new Error("Reopen claim review before recovering documents.");
      // Legacy reservations may contain PostgreSQL submillisecond timestamps.
      const [recovered] = await tx.update(claimAttachments).set({ uploadState: "ready", uploadError: null, updatedAt: new Date() })
        .where(and(eq(claimAttachments.id, attachmentId), eq(claimAttachments.uploadState, attachment.uploadState),
          sql`date_trunc('milliseconds', ${claimAttachments.updatedAt}) = ${attachment.updatedAt.toISOString()}::timestamp`)).returning();
      if (!recovered) throw new Error("This upload changed. Refresh the claim before checking again.");
      await tx.update(claims).set({ version: sql`${claims.version} + 1` }).where(eq(claims.id, claimId));
      await tx.insert(claimEvents).values({ claimId, actorId: session.id, type: "document_uploaded", content: `Stored document recovered: ${attachment.originalFilename}. Awaiting manual review.`, metadata: { attachmentId, category: attachment.category, recovered: true } });
    });
    revalidatePath(`/claims/${claimId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: actionError(error, "Could not recover this upload. Select the original file and retry.") };
  }
}
