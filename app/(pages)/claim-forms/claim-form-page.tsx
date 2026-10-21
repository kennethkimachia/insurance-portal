import {
  getPoliciesForClaimForm,
  getMyDrafts,
  getMyClaimDraft,
} from "@/app/actions/user/my-claims";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import ClaimsPageClient from "./claim-forms-client";
import { z } from "zod";

export async function ClaimFormPage({
  searchParams,
  policyType,
}: {
  searchParams: Promise<{ policy?: string; draft?: string }>;
  policyType?: "motor" | "burglary";
}) {
  await requireSession();
  const query = await searchParams;
  const [policies, drafts] = await Promise.all([
    getPoliciesForClaimForm(),
    getMyDrafts(),
  ]);
  let initialDraft: Awaited<ReturnType<typeof getMyClaimDraft>> | undefined;
  let recoveryMessage: string | undefined;
  if (query.draft && z.string().uuid().safeParse(query.draft).success) {
    try {
      initialDraft = await getMyClaimDraft(query.draft);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "This report has already been submitted"
      )
        redirect(`/claims/${query.draft}`);
      recoveryMessage =
        "This draft could not be loaded. Check the link or select its policy to retry saving with the same reference. Only previously confirmed saves can be restored.";
    }
  } else if (query.draft)
    recoveryMessage =
      "This draft link is invalid. Select a policy below to start a report.";
  const policyId = initialDraft?.policyId ?? query.policy;
  const eligible = policyType
    ? policies.filter((p) => p.policyType === policyType)
    : policies;
  const selected =
    eligible.find((p) => p.id === policyId) ??
    (policyType && eligible.length === 1 ? eligible[0] : undefined);
  return (
    <ClaimsPageClient
      key={`${selected?.id ?? "select"}:${initialDraft?.id ?? query.draft ?? "new"}`}
      policies={eligible}
      drafts={drafts.filter((d) => !policyType || d.policyType === policyType)}
      initialPolicyId={selected?.id}
      initialDraft={
        initialDraft
          ? {
              claimId: initialDraft.claimId,
              claimNumber: initialDraft.claimNumber,
              savedAt: initialDraft.savedAt,
              formData: initialDraft.formData,
            }
          : undefined
      }
      initialClaimId={
        !initialDraft && z.string().uuid().safeParse(query.draft).success
          ? query.draft
          : undefined
      }
      recoveryMessage={recoveryMessage}
    />
  );
}
