"use client";

import { UnassignedClaims } from "@/components/dashboard/head-agent/unassigned-claims";
import { AgentWorkload } from "@/components/dashboard/head-agent/agent-workload";
import { BottleneckReport } from "@/components/dashboard/head-agent/bottleneck-report";
import { ReassignAgentDialog } from "@/components/dashboard/head-agent/reassign-agent-dialog";
import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string;
  activeClaimCount: number;
  latestClaim?: string;
}

interface UnassignedClaim {
  id: string;
  claimNumber: string;
  status: string;
  description: string | null;
  policyType: string;
  policyholderName: string;
  policyholderEmail: string;
  createdAt: string;
}

interface BottleneckMetric {
  stage: string;
  label: string;
  count: number;
}

interface HeadAgentDashboardClientProps {
  organizationId: string;
  unassignedClaims: UnassignedClaim[];
  agents: Agent[];
  bottleneckMetrics: BottleneckMetric[];
}

export function HeadAgentDashboardClient({
  organizationId,
  unassignedClaims,
  agents,
  bottleneckMetrics,
}: HeadAgentDashboardClientProps) {
  const [showReassign, setShowReassign] = useState(false);

  // Find the first assigned claim for the reassign demo
  const firstAssignedAgent = agents.find((a) => a.latestClaim);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Head Agent Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage claim assignments, monitor agent workloads, and identify
            bottlenecks.
          </p>
        </div>

        {/* Unassigned Claims */}
        <UnassignedClaims
          claims={unassignedClaims.map((c) => ({
            id: c.id,
            claimNumber: c.claimNumber,
            policyType: c.policyType as "motor" | "burglary",
            policyholderName: c.policyholderName,
            description: c.description || "",
            createdAt: c.createdAt,
          }))}
          agents={agents}
        />

        {/* Agent Workload */}
        <div className="mt-6">
          <AgentWorkload agents={agents} />
        </div>

        {/* Bottleneck Report + Reassignment */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <BottleneckReport
            metrics={bottleneckMetrics.map((m) => ({
              stage: m.stage,
              label: m.label,
              avgDays: m.count, // Using count as the metric value
            }))}
          />

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Quick Reassignment
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Move a claim to another agent if the current agent is on leave
                or overloaded.
              </p>
              {firstAssignedAgent?.latestClaim ? (
                <button
                  onClick={() => setShowReassign(!showReassign)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {showReassign
                    ? "Close"
                    : `Reassign ${firstAssignedAgent.latestClaim}`}
                </button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No assigned claims available to reassign.
                </p>
              )}
            </div>

            {showReassign && firstAssignedAgent?.latestClaim && (
              <ReassignAgentDialog
                claimNumber={firstAssignedAgent.latestClaim}
                currentAgentName={firstAssignedAgent.name}
                agents={agents}
                onClose={() => setShowReassign(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
