import { ClaimFormPage } from "../claim-form-page";
import { notFound } from "next/navigation";
export default async function TypedClaimFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ policyType: string }>;
  searchParams: Promise<{ policy?: string; draft?: string }>;
}) {
  const { policyType } = await params;
  if (policyType !== "motor" && policyType !== "burglary") notFound();
  return <ClaimFormPage searchParams={searchParams} policyType={policyType} />;
}
