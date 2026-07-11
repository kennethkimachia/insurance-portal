"use client";

import { ClaimTrackerDynamic } from "@/components/dashboard/user/claim-tracker-dynamic";
import { NextSteps } from "@/components/dashboard/user/next-steps";
import { DocumentVault } from "@/components/dashboard/user/document-vault";
import { ContactHelper } from "@/components/dashboard/user/contact-helper";
import { PaymentStatus } from "@/components/dashboard/user/payment-status";
import { useState, useTransition } from "react";
import { getMyClaimProgress, getMyClaimAgent, getMyClaimAttachments } from "@/app/actions/user/my-claims";

interface Claim {
  id: string;
  claimNumber: string;
  status: string;
  description: string | null;
  policyType: string;
  policyNumber: string;
  organizationName: string;
  createdAt: string;
}

interface ProgressStep {
  id: string;
  claimId: string;
  stepOrder: number;
  label: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

interface Policy {
  id: string;
  policyNumber: string;
  policyType: string;
  organizationName: string;
  createdAt: string;
}

import { useOrg } from "@/lib/org-context";

interface UserDashboardClientProps {
  userName: string;
  claims: Claim[];
  policies: Policy[];
  initialProgress: ProgressStep[];
  initialAgent: Agent | null;
  initialAttachments: Attachment[];
}

export function UserDashboardClient({
  userName,
  claims,
  policies,
  initialProgress,
  initialAgent,
  initialAttachments,
}: UserDashboardClientProps) {
  const { currentOrg } = useOrg();
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress);
  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isPending, startTransition] = useTransition();

  const filteredClaims = claims.filter(
    (c) => !currentOrg || c.organizationName === currentOrg.name
  );

  const filteredPolicies = policies.filter(
    (p) => !currentOrg || p.organizationName === currentOrg.name
  );

  const selectedClaim = filteredClaims[selectedClaimIndex] || filteredClaims[0];

  function handleClaimChange(index: number) {
    setSelectedClaimIndex(index);
    const claim = filteredClaims[index];
    if (!claim) return;
    startTransition(async () => {
      const [newProgress, newAgent, newAttachments] = await Promise.all([
        getMyClaimProgress(claim.id),
        getMyClaimAgent(claim.id),
        getMyClaimAttachments(claim.id),
      ]);
      setProgress(newProgress);
      setAgent(newAgent);
      setAttachments(newAttachments);
    });
  }

  if (filteredClaims.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome, {userName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Here&apos;s an overview of your insurance claims and policies for {currentOrg?.name || "this organization"}.
            </p>
          </div>

          {/* Show policies if any */}
          {filteredPolicies.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-lg font-semibold text-foreground">
                  Your Policies
                </h3>
                <div className="mt-4 space-y-3">
                  {filteredPolicies.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {p.policyNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.policyType === "motor"
                            ? "Motor Insurance"
                            : "Burglary Insurance"}{" "}
                          · {p.organizationName}
                        </p>
                      </div>
                      <a
                        href="/claim-forms"
                        className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        File a Claim
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <p className="text-muted-foreground">
                You don&apos;t have any active policies yet for {currentOrg?.name || "this organization"}. Please contact your
                insurance agent to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine next step for the user
  const nextStep = (() => {
    const incompleteSteps = progress.filter((s) => !s.isCompleted);
    if (incompleteSteps.length > 0) {
      return {
        actionRequired: false,
        message: `Current step: ${incompleteSteps[0].label}${incompleteSteps[0].description ? ` — ${incompleteSteps[0].description}` : ""}`,
        claimNumber: selectedClaim?.claimNumber || "",
      };
    }
    return {
      actionRequired: false,
      message: "All progress steps are complete. Your agent will follow up shortly.",
      claimNumber: selectedClaim?.claimNumber || "",
    };
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {userName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s an overview of your insurance claims and policies.
          </p>
        </div>

        {/* Claim selector if multiple claims */}
        {filteredClaims.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            {filteredClaims.map((claim, i) => (
              <button
                key={claim.id}
                onClick={() => handleClaimChange(i)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  i === selectedClaimIndex
                    ? "border-primary bg-primary/5 font-semibold text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {claim.claimNumber}
              </button>
            ))}
          </div>
        )}

        {/* Claim Tracker + Next Steps */}
        {selectedClaim && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ClaimTrackerDynamic
                claim={{
                  claimNumber: selectedClaim.claimNumber,
                  policyType: selectedClaim.policyType as "motor" | "burglary",
                  description: selectedClaim.description || "",
                  createdAt: selectedClaim.createdAt,
                }}
                progressSteps={progress}
              />
            </div>
            <div>
              <NextSteps step={nextStep} />
            </div>
          </div>
        )}

        {/* Document Vault + Contact + Payment */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentVault documents={attachments} />
          </div>
          <div className="flex flex-col gap-6">
            {agent && (
              <ContactHelper agent={agent} />
            )}
            <PaymentStatus
              payment={{
                status: selectedClaim?.status === "settled" ? "paid" : "pending",
                expectedAmount: 0,
                currency: "KES",
                referenceNumber: null,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
