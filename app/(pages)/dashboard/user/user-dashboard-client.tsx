"use client";

import { ClaimTrackerDynamic } from "@/components/dashboard/user/claim-tracker-dynamic";
import { NextSteps } from "@/components/dashboard/user/next-steps";
import { DocumentVault } from "@/components/dashboard/user/document-vault";
import { ContactHelper } from "@/components/dashboard/user/contact-helper";
import { PaymentStatus } from "@/components/dashboard/user/payment-status";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState, useTransition } from "react";
import {
  deleteMyClaim,
  getMyClaimProgress,
  getMyClaimAgent,
  getMyClaimAttachments,
} from "@/app/actions/user/my-claims";
import { useOrg } from "@/lib/org-context";
import { FilePlus2, Loader2, Trash2 } from "lucide-react";

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
  const [claimItems, setClaimItems] = useState(claims);
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressStep[]>(initialProgress);
  const [agent, setAgent] = useState<Agent | null>(initialAgent);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredClaims = claimItems.filter(
    (c) => !currentOrg || c.organizationName === currentOrg.name
  );

  const filteredPolicies = policies.filter(
    (p) => !currentOrg || p.organizationName === currentOrg.name
  );

  const selectedClaim = filteredClaims[selectedClaimIndex] || filteredClaims[0];
  const canDeleteSelected =
    selectedClaim && !["approved", "settled"].includes(selectedClaim.status);

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

  function handleDeleteClaim(claimId: string) {
    setDeletingClaimId(claimId);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteMyClaim(claimId);
      if (!result.success) {
        setDeleteError(result.error ?? "Unable to delete this claim");
        setDeletingClaimId(null);
        return;
      }

      setClaimItems((prev) => prev.filter((claim) => claim.id !== claimId));
      if (selectedClaim?.id === claimId) {
        setSelectedClaimIndex(0);
        setProgress([]);
        setAgent(null);
        setAttachments([]);
      }
      setDeletingClaimId(null);
    });
  }

  const createClaimButton = filteredPolicies.length > 0 ? (
    <Button asChild className="gap-1.5">
      <a href="/claim-forms">
        <FilePlus2 className="h-4 w-4" />
        File a Claim
      </a>
    </Button>
  ) : null;

  if (filteredClaims.length === 0) {
    return (
      <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Welcome, {userName}
              </h1>
              <p className="mt-1 text-muted-foreground">
                Here&apos;s an overview of your insurance claims and policies for {currentOrg?.name || "this organization"}.
              </p>
            </div>
            {createClaimButton}
          </div>

          {filteredPolicies.length > 0 ? (
            <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-foreground">Your Policies</h3>
              <div className="mt-4 space-y-3">
                {filteredPolicies.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold text-foreground">{p.policyNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.policyType === "motor" ? "Motor Insurance" : "Burglary Insurance"} - {p.organizationName}
                      </p>
                    </div>
                    <Button asChild size="sm" className="gap-1.5">
                      <a href="/claim-forms">
                        <FilePlus2 className="h-3.5 w-3.5" />
                        File a Claim
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <p className="text-muted-foreground">
                You don&apos;t have any active policies yet for {currentOrg?.name || "this organization"}. Please contact your insurance agent to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const nextStep = (() => {
    const incompleteSteps = progress.filter((s) => !s.isCompleted);
    if (incompleteSteps.length > 0) {
      return {
        actionRequired: false,
        message: `Current step: ${incompleteSteps[0].label}${incompleteSteps[0].description ? ` - ${incompleteSteps[0].description}` : ""}`,
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
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Here&apos;s an overview of your insurance claims and policies.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {createClaimButton}
            {selectedClaim && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-1.5" disabled={!canDeleteSelected || isPending}>
                    <Trash2 className="h-4 w-4" />
                    Delete Claim
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this claim?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes claim {selectedClaim.claimNumber} and its submitted documents from your dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleDeleteClaim(selectedClaim.id)}
                    >
                      {deletingClaimId === selectedClaim.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {filteredClaims.length > 1 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
            {filteredClaims.map((claim, i) => (
              <button
                key={claim.id}
                onClick={() => handleClaimChange(i)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  i === selectedClaimIndex
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {claim.claimNumber}
              </button>
            ))}
          </div>
        )}

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

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentVault documents={attachments} />
          </div>
          <div className="flex flex-col gap-6">
            {agent && <ContactHelper agent={agent} />}
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