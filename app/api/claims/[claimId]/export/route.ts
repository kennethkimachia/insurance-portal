import { NextResponse } from "next/server";
import { getClaimWorkspace } from "@/app/actions/user/my-claims";
import { requireSession } from "@/lib/session";
import { getAuthorizedClaimAttachment } from "@/lib/claim-attachment-access";
import { streamClaimFile } from "@/lib/storage";
import { assertPackageSize, createClaimPackage, verifiedDocumentBytes } from "@/lib/claim-export-package";
import { exportFilename } from "@/lib/claim-export-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await context.params;
    const session = await requireSession();
    const data = await getClaimWorkspace(claimId);
    try {
      assertPackageSize(data.documents);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 413, headers: { "Cache-Control": "private, no-store" } });
    }
    const body = createClaimPackage(data, async function* (document, signal) {
      // Recheck claim membership, document state and storage prefix at read time.
      // Never place signed URLs, storage keys or portal-only links in the report.
      const attachment = await getAuthorizedClaimAttachment(session, claimId, document.id);
      yield* verifiedDocumentBytes(
        streamClaimFile(attachment.storageKey, signal),
        attachment.sizeBytes,
        attachment.contentSha256,
      );
    }, new Date().toISOString(), request.signal);
    const filename = `${exportFilename(data.claim.claimNumber)}-claim-report.zip`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="claim-report.zip"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Claim not found or access denied" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
