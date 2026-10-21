import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { claimAttachments } from "@/db/schema";
import { requireClaimAccess } from "./claim-access";
import type { SessionUser } from "./session";

export class ClaimAttachmentAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 | 500,
  ) {
    super(message);
  }
}

export async function getAuthorizedClaimAttachment(
  session: SessionUser,
  claimId: string,
  attachmentId: string,
) {
  let claim;
  try {
    claim = await requireClaimAccess(session, claimId);
  } catch {
    throw new ClaimAttachmentAccessError(
      "Attachment not found or access denied",
      404,
    );
  }
  const [attachment] = await db
    .select()
    .from(claimAttachments)
    .where(
      and(
        eq(claimAttachments.id, attachmentId),
        eq(claimAttachments.claimId, claimId),
      ),
    )
    .limit(1);
  if (!attachment)
    throw new ClaimAttachmentAccessError("Attachment not found", 404);
  if (attachment.uploadState !== "ready")
    throw new ClaimAttachmentAccessError(
      "Document upload is incomplete. Retry the original file.",
      403,
    );
  if (
    attachment.scanState === "rejected" ||
    (session.role === "user" && attachment.scanState !== "clean")
  )
    throw new ClaimAttachmentAccessError(
      "Document is awaiting review or needs replacement",
      403,
    );
  // Staff may download pending files for explicit manual inspection. Downloads are
  // always attachment/octet-stream and never embedded as active browser content.
  if (
    !attachment.storageKey.startsWith(
      `${claim.organizationId}/claims/${claimId}/`,
    )
  )
    throw new ClaimAttachmentAccessError("Attachment unavailable", 500);
  return attachment;
}
