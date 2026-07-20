import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "@/lib/storage";
import { buildClaimFileKey } from "@/lib/storage";
import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { claims, policies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireOrganizationAccess } from "@/lib/organization-access";

// Allow uploads up to 50 MB (Next.js defaults to 1 MB)
export const config = {
  api: { bodyParser: false },
};


const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const claimId = formData.get("claimId") as string | null;
    const organizationId = formData.get("organizationId") as string | null;

    if (!file || !claimId || !organizationId) {
      return NextResponse.json(
        { error: "Missing file, claimId, or organizationId" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 50 MB limit" },
        { status: 400 },
      );
    }

    // Verify access to this claim
    const [claim] = await db
      .select({
        organizationId: claims.organizationId,
        policyholderId: policies.userId,
      })
      .from(claims)
      .innerJoin(policies, eq(policies.id, claims.policyId))
      .where(eq(claims.id, claimId))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (session.role === "user" && claim.policyholderId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.role !== "user") {
      await requireOrganizationAccess(session, claim.organizationId);
    }

    if (claim.organizationId !== organizationId) {
      return NextResponse.json(
        { error: "Organization mismatch" },
        { status: 403 },
      );
    }

    // Build storage key and upload directly from the server
    const key = buildClaimFileKey(organizationId, claimId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      }),
    );

    return NextResponse.json({ key, size: file.size });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
