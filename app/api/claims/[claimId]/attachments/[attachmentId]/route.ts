import { NextRequest, NextResponse } from "next/server";
import {
  ClaimAttachmentAccessError,
  getAuthorizedClaimAttachment,
} from "@/lib/claim-attachment-access";
import { getSessionUser } from "@/lib/session";
import { getFileUrl } from "@/lib/storage";
import { StorageConfigurationError } from "@/lib/storage-policy";
import { evidencePreviewType } from "@/lib/evidence-presentation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    claimId: string;
    attachmentId: string;
  }>;
}

function attachmentContentDisposition(filename: string) {
  const quote = String.fromCharCode(34);
  const apostrophe = String.fromCharCode(39);
  const fallbackFilename = filename
    .replace(/[\r\n]/g, "_")
    .replaceAll(quote, "_");
  const encodedFilename = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );

  return (
    "attachment; filename=" +
    quote +
    fallbackFilename +
    quote +
    "; filename*=UTF-8" +
    apostrophe +
    apostrophe +
    encodedFilename
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session || !session.emailVerified) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { claimId, attachmentId } = await context.params;

  try {
    const attachment = await getAuthorizedClaimAttachment(
      session,
      claimId,
      attachmentId,
    );
    const preview = request.nextUrl.searchParams.get("preview") === "1";
    const previewType = evidencePreviewType(attachment.contentType);
    if (preview && !previewType) return NextResponse.json({ error: "This file type must be downloaded for inspection." }, { status: 415 });
    const fileUrl = await getFileUrl(attachment.storageKey, 5 * 60, {
      contentType: preview ? previewType! : "application/octet-stream",
      contentDisposition: attachmentContentDisposition(
        attachment.originalFilename,
      ).replace(/^attachment;/, preview ? "inline;" : "attachment;"),
    });
    // Preview URLs use the separate private storage origin, never the app origin.
    // Only passive image/PDF/video MIME types are allowed to render in the viewer.
    const response = preview ? NextResponse.json({ url: fileUrl, contentType: previewType }) : NextResponse.redirect(fileUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof StorageConfigurationError)
      return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof ClaimAttachmentAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Could not create attachment view URL", {
      claimId,
      attachmentId,
    });
    return NextResponse.json(
      { error: "Attachment unavailable" },
      { status: 500 },
    );
  }
}
