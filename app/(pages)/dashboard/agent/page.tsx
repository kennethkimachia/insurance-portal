"use client";

import { MyQueue } from "@/components/dashboard/agent/my-queue";
import { StatusEditor } from "@/components/dashboard/agent/status-editor";
import { OnboardPolicyholder } from "@/components/dashboard/agent/onboard-policyholder";
import { ClaimTimeline } from "@/components/dashboard/agent/claim-timeline";
import { useState } from "react";

// ── Mock Data ───────────────────────────────────────────────────────────

const mockClaims = [
  {
    id: "c1",
    claimNumber: "CLM-ABC-00038",
    policyholderName: "Sarah Wambui",
    policyType: "motor" as const,
    status: "under_review" as const,
    description: "Rear-end collision on Mombasa Road",
    createdAt: "2026-02-10",
  },
  {
    id: "c2",
    claimNumber: "CLM-ABC-00039",
    policyholderName: "Peter Mutiso",
    policyType: "burglary" as const,
    status: "assigned" as const,
    description: "Break-in at Kilimani apartment, electronics stolen",
    createdAt: "2026-02-12",
  },
  {
    id: "c3",
    claimNumber: "CLM-ABC-00040",
    policyholderName: "Grace Atieno",
    policyType: "motor" as const,
    status: "surveyor_dispatched" as const,
    description: "Windshield crack from road debris, Thika Road",
    createdAt: "2026-02-14",
  },
  {
    id: "c4",
    claimNumber: "CLM-ABC-00041",
    policyholderName: "John Omondi",
    policyType: "motor" as const,
    status: "approved" as const,
    description: "Hit-and-run damage, Lang'ata",
    createdAt: "2026-01-28",
  },
  {
    id: "c5",
    claimNumber: "CLM-ABC-00036",
    policyholderName: "Mary Njeri",
    policyType: "burglary" as const,
    status: "settled" as const,
    description: "Office break-in, Westlands",
    createdAt: "2026-01-15",
  },
];

const mockTimelineEntries = [
  {
    id: "t1",
    author: "System",
    role: "system" as const,
    content: "Claim CLM-ABC-00038 was assigned to you.",
    createdAt: "2026-02-10T09:00:00Z",
  },
  {
    id: "t2",
    author: "James Kariuki",
    role: "agent" as const,
    content:
      "Contacted the policyholder. She confirmed the incident happened at the Nyayo Stadium roundabout.",
    createdAt: "2026-02-11T14:30:00Z",
  },
  {
    id: "t3",
    author: "System",
    role: "system" as const,
    content: 'Status updated to "Surveyor Dispatched".',
    createdAt: "2026-02-12T08:00:00Z",
  },
  {
    id: "t4",
    author: "James Kariuki",
    role: "agent" as const,
    content:
      "Spoke to the garage, they expect parts by Tuesday. Repair estimate is KES 85,000.",
    createdAt: "2026-02-14T11:15:00Z",
  },
  {
    id: "t5",
    author: "System",
    role: "system" as const,
    content: 'Status updated to "Under Review".',
    createdAt: "2026-02-15T09:00:00Z",
  },
];

export default function AgentDashboard() {
  const [selectedClaimId, setSelectedClaimId] = useState(mockClaims[0].id);

  const selectedClaim =
    mockClaims.find((c) => c.id === selectedClaimId) || mockClaims[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Agent Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your assigned claims, update statuses, and communicate with
            policyholders.
          </p>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: My Queue */}
          <div className="lg:col-span-2">
            <MyQueue
              claims={mockClaims}
              onSelectClaim={(claim) => setSelectedClaimId(claim.id)}
              selectedClaimId={selectedClaimId}
            />
          </div>

          {/* Right: Status Editor + Timeline */}
          <div className="space-y-6 lg:col-span-3">
            <StatusEditor
              claimNumber={selectedClaim.claimNumber}
              currentStatus={selectedClaim.status}
              key={selectedClaim.id} // reset on claim change
            />

            <ClaimTimeline
              claimNumber={selectedClaim.claimNumber}
              entries={
                selectedClaim.id === mockClaims[0].id ? mockTimelineEntries : []
              }
              agentName="James Kariuki"
            />
          </div>
        </div>

        {/* Onboarding section */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <OnboardPolicyholder />
          <div className="rounded-xl border bg-card p-6">
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
                Use the timeline to post updates like garage estimates, parts
                arrival dates, or surveyor notes.
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
