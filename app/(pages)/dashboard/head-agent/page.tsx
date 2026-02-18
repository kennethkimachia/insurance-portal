"use client";

import { UnassignedClaims } from "@/components/dashboard/head-agent/unassigned-claims";
import { AgentWorkload } from "@/components/dashboard/head-agent/agent-workload";
import { ReassignAgentDialog } from "@/components/dashboard/head-agent/reassign-agent-dialog";
import { BottleneckReport } from "@/components/dashboard/head-agent/bottleneck-report";
import { useState } from "react";

// ── Mock Data ───────────────────────────────────────────────────────────

const mockAgents = [
  {
    id: "a1",
    name: "James Kariuki",
    email: "james@abcinsurance.co.ke",
    activeClaimCount: 7,
    latestClaim: "CLM-ABC-00038",
  },
  {
    id: "a2",
    name: "Wanjiku Mwangi",
    email: "wanjiku@abcinsurance.co.ke",
    activeClaimCount: 3,
    latestClaim: "CLM-ABC-00041",
  },
  {
    id: "a3",
    name: "Brian Ochieng",
    email: "brian@abcinsurance.co.ke",
    activeClaimCount: 11,
    latestClaim: "CLM-ABC-00040",
  },
  {
    id: "a4",
    name: "Amina Hassan",
    email: "amina@abcinsurance.co.ke",
    activeClaimCount: 1,
    latestClaim: "CLM-ABC-00035",
  },
  {
    id: "a5",
    name: "David Njoroge",
    email: "david@abcinsurance.co.ke",
    activeClaimCount: 5,
  },
  {
    id: "a6",
    name: "Faith Kamau",
    email: "faith@abcinsurance.co.ke",
    activeClaimCount: 0,
  },
];

const mockUnassignedClaims = [
  {
    id: "u1",
    claimNumber: "CLM-ABC-00043",
    policyType: "motor" as const,
    policyholderName: "Sarah Wambui",
    description: "Side-mirror damage, Westlands",
    createdAt: "2026-02-17",
  },
  {
    id: "u2",
    claimNumber: "CLM-ABC-00044",
    policyType: "burglary" as const,
    policyholderName: "Peter Mutiso",
    description: "Break-in at Kilimani apartment",
    createdAt: "2026-02-17",
  },
  {
    id: "u3",
    claimNumber: "CLM-ABC-00045",
    policyType: "motor" as const,
    policyholderName: "Grace Atieno",
    description: "Windshield crack, Thika Road",
    createdAt: "2026-02-18",
  },
];

const mockBottleneckMetrics = [
  { stage: "pending", label: "Pending", avgDays: 1 },
  { stage: "assigned", label: "Assigned", avgDays: 2 },
  { stage: "surveyor_dispatched", label: "Surveyor Dispatched", avgDays: 3 },
  { stage: "under_review", label: "Under Review", avgDays: 5 },
  { stage: "assessment_complete", label: "Assessment Complete", avgDays: 2 },
  { stage: "approved", label: "Approved → Settled", avgDays: 4 },
];

// A claim to demo reassignment
const mockReassignClaim = {
  claimNumber: "CLM-ABC-00038",
  currentAgentName: "James Kariuki",
};

export default function HeadAgentDashboard() {
  const [showReassign, setShowReassign] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Head Agent Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage claim assignments, monitor agent workloads, and identify
            bottlenecks.
          </p>
        </div>

        {/* Unassigned Claims */}
        <UnassignedClaims claims={mockUnassignedClaims} agents={mockAgents} />

        {/* Agent Workload */}
        <div className="mt-6">
          <AgentWorkload agents={mockAgents} />
        </div>

        {/* Bottleneck Report + Reassignment */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <BottleneckReport metrics={mockBottleneckMetrics} />

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Quick Reassignment
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Move a claim to another agent if the current agent is on leave
                or overloaded.
              </p>
              <button
                onClick={() => setShowReassign(!showReassign)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {showReassign ? "Close" : "Reassign CLM-ABC-00038"}
              </button>
            </div>

            {showReassign && (
              <ReassignAgentDialog
                claimNumber={mockReassignClaim.claimNumber}
                currentAgentName={mockReassignClaim.currentAgentName}
                agents={mockAgents}
                onClose={() => setShowReassign(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
