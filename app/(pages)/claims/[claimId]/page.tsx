import { getClaimWorkspace } from "@/app/actions/user/my-claims";
import { ClaimWorkspace } from "@/components/claims/claim-workspace";
import { notFound, redirect } from "next/navigation";
export default async function ClaimPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const { claimId } = await params;
  let data;
  try {
    data = await getClaimWorkspace(claimId);
  } catch {
    notFound();
  }
  if (data.claim.status === "draft" && data.role === "user")
    redirect(`/claim-forms/${data.claim.policyType}?draft=${data.claim.id}`);
  return <ClaimWorkspace key={data.claim.id} data={data} />;
}
