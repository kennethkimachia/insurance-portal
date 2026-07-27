"use client";

import { MyQueue } from "@/components/dashboard/agent/my-queue";
import { StatusEditor } from "@/components/dashboard/agent/status-editor";
import { OnboardPolicyholder } from "@/components/dashboard/agent/onboard-policyholder";
import { ClaimTimeline } from "@/components/dashboard/agent/claim-timeline";
import { ProgressEditor } from "@/components/dashboard/agent/progress-editor";
import { ClaimAssessment } from "@/components/dashboard/agent/claim-assessment";
import { useState, useTransition, useCallback } from "react";
import { getClaimTimeline, getClaimDetails } from "@/app/actions/agent/manage-claims";
import { getProgressSteps } from "@/app/actions/agent/progress-steps";
import { useOrg } from "@/lib/org-context";

type ClaimStatus =
  | "pending"
  | "assigned"
  | "surveyor_dispatched"
  | "under_review"
  | "assessment_complete"
  | "approved"
  | "settled"
  | "rejected";

interface Claim {
  id: string;
  claimNumber: string;
  status: string;
  description: string | null;
  policyType: string;
  policyholderName: string;
  organizationName: string;
  createdAt: string;
}

interface TimelineEntry {
  id: string;
  author: string;
  role: string;
  content: string;
  createdAt: string;
}

type ClaimDetails = Awaited<ReturnType<typeof getClaimDetails>>;

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

interface AgentDashboardClientProps {
  claims: Claim[];
  agentName: string;
  initialTimeline: TimelineEntry[];
  initialProgressSteps: ProgressStep[];
  initialClaimDetails: ClaimDetails;
}

export function AgentDashboardClient({
  claims,
  agentName,
  initialTimeline,
  initialProgressSteps,
  initialClaimDetails,
}: AgentDashboardClientProps) {
  const { currentOrg } = useOrg();
  const [assignedClaims, setAssignedClaims] = useState(claims);
  const [selectedClaimId, setSelectedClaimId] = useState(claims[0]?.id ?? "");
  const [timeline, setTimeline] = useState<TimelineEntry[]>(initialTimeline);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>(initialProgressSteps);
  const [claimDetails, setClaimDetails] = useState<ClaimDetails>(initialClaimDetails);
  const [, startTransition] = useTransition();

  const filteredClaims = assignedClaims.filter(
    (c) => !currentOrg || c.organizationName === currentOrg.name
  );

  // Keep track of previously selected claim. If it is not in the filtered list,
  // select the first one of the filtered list.
  const selectedClaim =
    filteredClaims.find((c) => c.id === selectedClaimId) || filteredClaims[0];

  const handleSelectClaim = useCallback(
    (claim: { id: string }) => {
      setSelectedClaimId(claim.id);
      startTransition(async () => {
        const [newTimeline, newSteps, newDetails] = await Promise.all([
          getClaimTimeline(claim.id),
          getProgressSteps(claim.id),
          getClaimDetails(claim.id),
        ]);
        setTimeline(newTimeline);
        setProgressSteps(newSteps);
        setClaimDetails(newDetails);
      });
    },
    []
  );

  function handleStatusChange(newStatus: ClaimStatus) {
    setAssignedClaims((prev) =>
      prev.map((claim) =>
        claim.id === selectedClaimId ? { ...claim, status: newStatus } : claim
      )
    );
    setClaimDetails((prev) => (prev ? { ...prev, status: newStatus } : prev));
  }

  if (filteredClaims.length === 0) {
    return (
      <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Agent Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Welcome, {agentName}. No claims have been assigned to you yet for {currentOrg?.name || "this organization"}.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <OnboardPolicyholder
              organizationId={currentOrg?.id}
              organizationName={currentOrg?.name}
            />
            <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Getting Started
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Your head agent will assign claims to you from the queue.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  You can onboard new policyholders using the form on the left.
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Once claims are assigned, you&apos;ll see them here with full
                  management tools.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Agent Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your assigned claims, update statuses, and communicate with
            policyholders.
          </p>
        </div>

        {/* Main grid */}
        <div className="grid items-start gap-6 xl:grid-cols-12">
          {/* Left: My Queue */}
          <div className="min-w-0 xl:col-span-4">
            <MyQueue
              claims={filteredClaims.map((c) => ({
                id: c.id,
                claimNumber: c.claimNumber,
                policyholderName: c.policyholderName,
                policyType: c.policyType as "motor" | "burglary",
                status: c.status as ClaimStatus,
                description: c.description || "",
                createdAt: c.createdAt,
              }))}
              onSelectClaim={handleSelectClaim}
              selectedClaimId={selectedClaimId}
            />
          </div>

          {/* Right: Status Editor + Progress + Timeline */}
          <div className="min-w-0 space-y-6 xl:col-span-8">
            {selectedClaim && (
              <>
                <ClaimAssessment details={claimDetails} />

                <div className="grid items-start gap-6 lg:grid-cols-2">
                  <StatusEditor
                    claimNumber={selectedClaim.claimNumber}
                    currentStatus={selectedClaim.status as ClaimStatus}
                    claimId={selectedClaim.id}
                    onStatusChange={handleStatusChange}
                    key={`status-${selectedClaim.id}`}
                  />

                  <ProgressEditor
                  claimId={selectedClaim.id}
                  claimNumber={selectedClaim.claimNumber}
                  initialSteps={progressSteps}
                    key={`progress-${selectedClaim.id}`}
                  />
                </div>

                <ClaimTimeline
                  claimNumber={selectedClaim.claimNumber}
                  entries={timeline.map((t) => ({
                    ...t,
                    role: t.role as "system" | "agent" | "user",
                  }))}
                  agentName={agentName}
                  claimId={selectedClaim.id}
                  key={`timeline-${selectedClaim.id}`}
                />
              </>
            )}
          </div>
        </div>

        {/* Onboarding section */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <OnboardPolicyholder
            organizationId={currentOrg?.id}
            organizationName={currentOrg?.name}
          />
          <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Quick Tips
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                Select a claim from your queue to view its timeline and update
                its status.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                When you change a claim&apos;s status, a notification is
                automatically sent to the policyholder.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                Use the progress editor to add custom steps that reflect the
                carrier&apos;s internal process.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                The &quot;Quick Create&quot; form lets you register a new
                policyholder and generate their first policy document.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
