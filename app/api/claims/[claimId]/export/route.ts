import { NextResponse } from "next/server";
import { getClaimWorkspace } from "@/app/actions/user/my-claims";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ claimId: string }> },
) {
  try {
    const { claimId } = await context.params;
    const data = await getClaimWorkspace(claimId);
    // URLs, storage keys and private staff activity are excluded from a carrier package.
    const packet = {
      exportedAt: new Date().toISOString(),
      source: "Insurance portal prototype; manual export only",
      receipt: {
        claimId: data.claim.id,
        reference: data.claim.claimNumber,
        submittedAt: data.claim.submittedAt,
        status: data.claim.status,
      },
      policy: data.claim.policySnapshot,
      policyholder: {
        name: data.claim.policyholderName,
        email: data.claim.policyholderEmail,
        contactPhone: data.claim.contactPhone,
      },
      originalReport: data.claim.originalSubmission,
      amendments: data.events.filter(
        (e) => e.type === "amendment" && e.visibility === "public",
      ),
      evidence: data.documents,
      requests: data.requests,
      handoff: {
        source: data.claim.carrierHandoffState,
        reference: data.claim.carrierReference,
      },
      outcome: {
        source: data.claim.outcomeSource,
        reason: data.claim.outcomeReason,
        settlementAmount: data.claim.settlementAmount,
        settlementReference: data.claim.settlementReference,
      },
    };
    return new NextResponse(JSON.stringify(packet, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${data.claim.claimNumber}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Claim not found or access denied" },
      { status: 404 },
    );
  }
}
