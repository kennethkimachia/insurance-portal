"use client";

import Link from "next/link";
import { UnassignedClaims } from "@/components/dashboard/head-agent/unassigned-claims";
import { AgentWorkload } from "@/components/dashboard/head-agent/agent-workload";
import { BottleneckReport } from "@/components/dashboard/head-agent/bottleneck-report";
import { ReassignAgentDialog } from "@/components/dashboard/head-agent/reassign-agent-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  statusLabels,
  claimStatuses,
  closedClaimStatuses,
  type ClaimStatus,
} from "@/lib/claim-workflow";
import type {
  getManagedClaims,
  getUnassignedClaims,
  getAgentWorkloads,
  getBottleneckMetrics,
} from "@/app/actions/head-agent/manage-claims";

interface Props {
  organizationId: string;
  unassignedClaims: Awaited<ReturnType<typeof getUnassignedClaims>>;
  agents: Awaited<ReturnType<typeof getAgentWorkloads>>;
  bottleneckMetrics: Awaited<ReturnType<typeof getBottleneckMetrics>>;
  managedClaims: Awaited<ReturnType<typeof getManagedClaims>>;
}

export function HeadAgentDashboardClient({
  organizationId,
  unassignedClaims,
  agents,
  bottleneckMetrics,
  managedClaims,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState("all");
  const query = search.trim().toLowerCase();
  const matching = managedClaims.filter(
    (claim) =>
      (stage === "all" ||
        (stage === "unassigned"
          ? !claim.assignedAgentId &&
            !closedClaimStatuses.includes(claim.status)
          : stage === "overdue"
            ? claim.overdueRequestCount > 0
            : claim.status === stage)) &&
      (!query ||
        `${claim.claimNumber} ${claim.policyholderName} ${claim.agentName ?? ""}`
          .toLowerCase()
          .includes(query)),
  );
  const selected = managedClaims.find((claim) => claim.id === selectedId);
  return (
    <main className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page">
        <div>
          <h1 className="portal-heading">
            Claims manager dashboard
          </h1>
          <p className="portal-intro">
            Assign work, review assessments, and record outcomes for the active
            organization.
          </p>
        </div>
        <p className="rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6">
          {managedClaims.filter((c) => c.overdueRequestCount > 0).length} claims
          have overdue information requests ? {unassignedClaims.length} reports
          await assignment.
        </p>
        <UnassignedClaims
          key={`${organizationId}-${unassignedClaims.map((claim) => claim.id).join()}`}
          claims={unassignedClaims.map((claim) => ({
            ...claim,
            policyType: claim.policyType as "motor" | "burglary",
            description: claim.description ?? "",
          }))}
          agents={agents}
        />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <AgentWorkload agents={agents} />
          <BottleneckReport metrics={bottleneckMetrics} />
        </div>
        <section className="portal-panel space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">All submitted claims</h2>
            <p className="text-sm text-muted-foreground">
              Open a claim to inspect evidence, request information, and review
              its outcome.
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search managed claims"
            placeholder="Search reference, policyholder, or agent"
          />
          <select
            aria-label="Filter organization claims"
            className="min-h-9 max-w-full rounded-md border bg-background px-3 text-sm"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All submitted claims</option>
            <option value="unassigned">Unassigned work</option>
            <option value="overdue">Overdue information</option>
            {claimStatuses
              .filter((status) => status !== "draft")
              .map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
          </select>
          {matching.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching claims.</p>
          ) : (
            <div className="divide-y">
              {matching.map((claim) => (
                <article
                  key={claim.id}
                  className="portal-row -mx-2 flex flex-col gap-3 rounded-lg px-2 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/claims/${claim.id}`}
                      className="font-mono text-sm font-semibold hover:underline"
                    >
                      {claim.claimNumber}
                    </Link>
                    <p className="mt-1 text-sm">
                      {claim.policyholderName} ·{" "}
                      <span className="capitalize">{claim.policyType}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {claim.agentName ?? "Waiting for assignment"}
                    </p>
                    {claim.overdueRequestCount > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {claim.overdueRequestCount} overdue information request
                        {claim.overdueRequestCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {statusLabels[claim.status as ClaimStatus]}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/claims/${claim.id}`}>Open claim</Link>
                    </Button>
                    {claim.assignedAgentId &&
                      !closedClaimStatuses.includes(claim.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(claim.id)}
                        >
                          Reassign
                        </Button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {selected?.assignedAgentId && (
          <ReassignAgentDialog
            key={selected.id}
            claimId={selected.id}
            claimNumber={selected.claimNumber}
            currentAgentId={selected.assignedAgentId}
            currentAgentName={selected.agentName ?? "Current agent"}
            agents={agents}
            onReassign={() => setSelectedId(null)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </main>
  );
}
