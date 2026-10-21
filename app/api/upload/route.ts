import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, buildClaimFileKey } from "@/lib/storage";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { db } from "@/db";
import { claims, claimAttachments, claimEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  EVIDENCE_CATEGORIES,
  MAX_FILE_BYTES,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  evidenceCategoryApplies,
} from "@/lib/claim-evidence";
import { inspectEvidenceContent } from "@/lib/evidence-content";
import { createHash } from "node:crypto";
import { reserveUploadSlot } from "@/lib/upload-capacity";
import { actionError } from "@/lib/action-errors";

export const runtime = "nodejs";
const envelope = z.object({
  claimId: z.string().uuid(),
  clientUploadId: z.string().uuid(),
  category: z.enum(EVIDENCE_CATEGORIES),
  lossItemId: z.string().uuid().optional(),
});

async function boundedMultipart(req: NextRequest) {
  const max = MAX_FILE_BYTES + 128 * 1024;
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > max)
    throw new Error("File exceeds 50 MB limit");
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new Error("Use a multipart file upload");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing upload body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error("File exceeds 50 MB limit");
    }
    chunks.push(chunk.value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "content-type": req.headers.get("content-type")! },
  }).formData();
}

export async function POST(req: NextRequest) {
  let reservation: typeof claimAttachments.$inferSelect | undefined;
  let release: (() => void) | undefined;
  try {
    const session = await requireSession();
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    release = reserveUploadSlot(session.id);
    const form = await boundedMultipart(req);
    const data = envelope.parse({
      claimId: form.get("claimId"),
      clientUploadId: form.get("clientUploadId"),
      category: form.get("category"),
      lossItemId: form.get("lossItemId") || undefined,
    });
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0 || file.size > MAX_FILE_BYTES)
      throw new Error("Choose a nonempty file no larger than 50 MB");
    const claim = await requireClaimAccess(session, data.claimId, "upload");
    if (
      !evidenceCategoryApplies(
        claim.policyType,
        data.category,
        claim.formData?.premisesUse,
      )
    )
      throw new Error(
        "Choose an evidence category that applies to this report. Stock records apply to business burglary claims.",
      );
    if (data.lossItemId) {
      const items = claim.formData?.lossItems;
      if (
        !Array.isArray(items) ||
        !items.some(
          (item) =>
            item &&
            typeof item === "object" &&
            "itemKey" in item &&
            item.itemKey === data.lossItemId,
        )
      )
        throw new Error("Loss item does not belong to this claim");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = inspectEvidenceContent(
      data.category,
      file.name,
      file.type,
      bytes,
    );
    const contentSha256 = createHash("sha256").update(bytes).digest("hex");

    // Commit the reservation first. A killed process leaves a visible retryable
    // record and a known storage key instead of an untracked object.
    const prepared = await db.transaction(async (tx) => {
      const locked = await lockClaimForMutation(
        tx,
        session,
        data.claimId,
        undefined,
        "upload",
      );
      const [existing] = await tx
        .select()
        .from(claimAttachments)
        .where(
          and(
            eq(claimAttachments.claimId, data.claimId),
            eq(claimAttachments.clientUploadId, data.clientUploadId),
          ),
        )
        .limit(1);
      if (
        existing &&
        (existing.contentSha256 !== contentSha256 ||
          existing.category !== data.category ||
          existing.originalFilename !== file.name ||
          existing.lossItemId !== (data.lossItemId ?? null))
      )
        throw new Error(
          "This upload identifier belongs to another file. Select the intended file again.",
        );
      if (existing?.uploadState === "ready")
        return { row: existing, complete: true };
      if (
        ["draft", "approved", "settled", "rejected", "withdrawn"].includes(
          locked.status,
        )
      )
        throw new Error(
          "Documents can be added while a submitted claim is under review. Ask your agent to reopen review if needed.",
        );
      if (
        existing?.uploadState === "uploading" &&
        Date.now() - existing.updatedAt.getTime() < 5 * 60 * 1000
      )
        throw new Error(
          "This file is still uploading. Retry in a few minutes if it does not finish.",
        );
      if (
        !BUCKET ||
        !process.env.B2_ENDPOINT ||
        !process.env.B2_KEY_ID ||
        !process.env.B2_APP_KEY
      )
        throw new Error(
          "Document storage is not configured. Your claim remains submitted; retry documents later.",
        );
      let row;
      if (existing) {
        [row] = await tx
          .update(claimAttachments)
          .set({
            uploadState: "uploading",
            uploadError: null,
            updatedAt: new Date(),
            reviewStatus: "pending",
            scanState: "pending",
          })
          .where(eq(claimAttachments.id, existing.id))
          .returning();
      } else {
        const [totals] = await tx
          .select({
            count: sql<number>`count(*)::int`,
            size: sql<number>`coalesce(sum(${claimAttachments.sizeBytes}),0)::bigint`,
          })
          .from(claimAttachments)
          .where(eq(claimAttachments.claimId, data.claimId));
        if (
          Number(totals.count) >= MAX_UPLOAD_FILES ||
          Number(totals.size) + bytes.byteLength > MAX_TOTAL_UPLOAD_BYTES
        )
          throw new Error(
            "This claim has reached its 20-file or 150 MB evidence limit. Contact your agent.",
          );
        [row] = await tx
          .insert(claimAttachments)
          .values({
            claimId: data.claimId,
            storageKey: buildClaimFileKey(
              claim.organizationId,
              data.claimId,
              file.name,
            ),
            originalFilename: file.name,
            contentType,
            contentSha256,
            sizeBytes: bytes.byteLength,
            category: data.category,
            lossItemId: data.lossItemId,
            clientUploadId: data.clientUploadId,
            uploadedBy: session.id,
            scanState: "pending",
            uploadState: "uploading",
          })
          .returning();
      }
      await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1` })
        .where(eq(claims.id, claim.id));
      return { row, complete: false };
    });
    if (prepared.complete)
      return NextResponse.json({
        success: true,
        attachmentId: prepared.row.id,
        alreadyUploaded: true,
      });
    reservation = prepared.row;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: reservation.storageKey,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    const attachmentId = reservation.id;
    await db.transaction(async (tx) => {
      const locked = await lockClaimForMutation(
        tx,
        session,
        data.claimId,
        undefined,
        "upload",
      );
      if (
        ["approved", "settled", "rejected", "withdrawn"].includes(locked.status)
      )
        throw new Error("Claim changed during upload. Contact your agent.");
      const [finished] = await tx
        .update(claimAttachments)
        .set({ uploadState: "ready", uploadError: null, updatedAt: new Date() })
        .where(
          and(
            eq(claimAttachments.id, attachmentId),
            eq(claimAttachments.uploadState, "uploading"),
            eq(claimAttachments.updatedAt, prepared.row.updatedAt),
          ),
        )
        .returning();
      if (!finished)
        throw new Error("Upload changed. Refresh before retrying.");
      await tx
        .insert(claimEvents)
        .values({
          claimId: data.claimId,
          actorId: session.id,
          type: "document_uploaded",
          content: `Document received: ${file.name}. Awaiting manual review.`,
          metadata: { attachmentId, category: data.category },
        });
    });
    reservation = undefined;
    return NextResponse.json({
      success: true,
      attachmentId,
      alreadyUploaded: false,
    });
  } catch (err) {
    const message = actionError(
      err,
      "Upload failed. Your claim remains saved; retry the same file.",
    );
    if (reservation) {
      // Keep the reservation and its private key for an identical-file retry or
      // operator reconciliation. Never delete an object after an uncertain COMMIT.
      try {
        const [current] = await db
          .select()
          .from(claimAttachments)
          .where(eq(claimAttachments.id, reservation.id))
          .limit(1);
        // A lost COMMIT response must never cause deletion of a completed file.
        if (current?.uploadState === "ready")
          return NextResponse.json({
            success: true,
            attachmentId: current.id,
            alreadyUploaded: true,
          });
        await db
          .update(claimAttachments)
          .set({
            uploadState: "failed",
            uploadError:
              "Upload did not complete. Select the original file and retry.",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(claimAttachments.id, reservation.id),
              eq(claimAttachments.uploadState, "uploading"),
              eq(claimAttachments.updatedAt, reservation.updatedAt),
            ),
          );
      } catch {
        console.error("Upload reservation needs reconciliation", {
          attachmentId: reservation.id,
        });
      }
    }
    const denied = /Not authenticated|Verify your email|access denied/.test(
      message,
    );
    return NextResponse.json(
      { error: message },
      {
        status: denied
          ? 403
          : /capacity reached/.test(message)
            ? 429
            : /still uploading/.test(message)
              ? 409
              : 400,
      },
    );
  } finally {
    release?.();
  }
}
