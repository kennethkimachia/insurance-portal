"use client";

import { SystemOverview } from "@/components/dashboard/admin/system-overview";
import { ManageOrganizations } from "@/components/dashboard/admin/manage-organizations";
import { ManageAgents } from "@/components/dashboard/admin/manage-agents";
import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";

// ── Mock Data ───────────────────────────────────────────────────────────

const mockStats = {
  totalOrganizations: 3,
  totalAgents: 8,
  totalClaims: 47,
  pendingInvitations: 2,
};

const mockOrganizations = [
  {
    id: "org-1",
    name: "ABC Insurance",
    code: "ABC",
    agentCount: 4,
    claimCount: 28,
    createdAt: "2025-06-15",
  },
  {
    id: "org-2",
    name: "SafeGuard Underwriters",
    code: "SGU",
    agentCount: 3,
    claimCount: 15,
    createdAt: "2025-09-01",
  },
  {
    id: "org-3",
    name: "PanAfrica Cover",
    code: "PAC",
    agentCount: 1,
    claimCount: 4,
    createdAt: "2026-01-10",
  },
];

const mockAgents = [
  {
    id: "a1",
    name: "James Kariuki",
    email: "james@abcinsurance.co.ke",
    role: "head_agent" as const,
    organizationName: "ABC Insurance",
    createdAt: "2025-07-01",
  },
  {
    id: "a2",
    name: "Wanjiku Mwangi",
    email: "wanjiku@abcinsurance.co.ke",
    role: "agent" as const,
    organizationName: "ABC Insurance",
    createdAt: "2025-07-15",
  },
  {
    id: "a3",
    name: "Brian Ochieng",
    email: "brian@abcinsurance.co.ke",
    role: "agent" as const,
    organizationName: "ABC Insurance",
    createdAt: "2025-08-01",
  },
  {
    id: "a4",
    name: "Amina Hassan",
    email: "amina@safeguard.co.ke",
    role: "head_agent" as const,
    organizationName: "SafeGuard Underwriters",
    createdAt: "2025-09-15",
  },
  {
    id: "a5",
    name: "David Njoroge",
    email: "david@safeguard.co.ke",
    role: "agent" as const,
    organizationName: "SafeGuard Underwriters",
    createdAt: "2025-10-01",
  },
  {
    id: "a6",
    name: "Faith Kamau",
    email: "faith@safeguard.co.ke",
    role: "agent" as const,
    organizationName: "SafeGuard Underwriters",
    createdAt: "2025-10-15",
  },
  {
    id: "a7",
    name: "Kevin Maina",
    email: "kevin@panafrica.co.ke",
    role: "agent" as const,
    organizationName: "PanAfrica Cover",
    createdAt: "2026-01-20",
  },
  {
    id: "a8",
    name: "System Admin",
    email: "admin@portal.co.ke",
    role: "admin" as const,
    createdAt: "2025-06-01",
  },
];

const mockInvitations = [
  {
    id: "inv-1",
    email: "lucy@abcinsurance.co.ke",
    role: "agent" as const,
    status: "pending" as const,
    createdAt: "2026-02-16",
  },
  {
    id: "inv-2",
    email: "tom@panafrica.co.ke",
    role: "head_agent" as const,
    status: "pending" as const,
    createdAt: "2026-02-17",
  },
  {
    id: "inv-3",
    email: "john@safeguard.co.ke",
    role: "agent" as const,
    status: "accepted" as const,
    createdAt: "2026-01-20",
  },
];

const mockAssignments = [
  {
    id: "asgn-1",
    agentId: "a1",
    agentName: "James Kariuki",
    agentEmail: "james@abcinsurance.co.ke",
    organizationId: "org-1",
    organizationName: "ABC Insurance",
    organizationCode: "ABC",
    createdAt: "2025-07-01",
  },
  {
    id: "asgn-2",
    agentId: "a2",
    agentName: "Wanjiku Mwangi",
    agentEmail: "wanjiku@abcinsurance.co.ke",
    organizationId: "org-1",
    organizationName: "ABC Insurance",
    organizationCode: "ABC",
    createdAt: "2025-07-15",
  },
  {
    id: "asgn-3",
    agentId: "a3",
    agentName: "Brian Ochieng",
    agentEmail: "brian@abcinsurance.co.ke",
    organizationId: "org-1",
    organizationName: "ABC Insurance",
    organizationCode: "ABC",
    createdAt: "2025-08-01",
  },
  {
    id: "asgn-4",
    agentId: "a4",
    agentName: "Amina Hassan",
    agentEmail: "amina@safeguard.co.ke",
    organizationId: "org-2",
    organizationName: "SafeGuard Underwriters",
    organizationCode: "SGU",
    createdAt: "2025-09-15",
  },
  {
    id: "asgn-5",
    agentId: "a5",
    agentName: "David Njoroge",
    agentEmail: "david@safeguard.co.ke",
    organizationId: "org-2",
    organizationName: "SafeGuard Underwriters",
    organizationCode: "SGU",
    createdAt: "2025-10-01",
  },
  {
    id: "asgn-6",
    agentId: "a7",
    agentName: "Kevin Maina",
    agentEmail: "kevin@panafrica.co.ke",
    organizationId: "org-3",
    organizationName: "PanAfrica Cover",
    organizationCode: "PAC",
    createdAt: "2026-01-20",
  },
];

// Simplified agent/org lists for the assignment selector
const agentOptions = mockAgents
  .filter((a) => a.role !== "admin")
  .map((a) => ({ id: a.id, name: a.name, email: a.email }));

const orgOptions = mockOrganizations.map((o) => ({
  id: o.id,
  name: o.name,
  code: o.code,
}));

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage organizations, agents, and system-wide settings.
          </p>
        </div>

        {/* System Overview */}
        <SystemOverview stats={mockStats} />

        {/* Organizations + Agents */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ManageOrganizations organizations={mockOrganizations} />
          <ManageAgents agents={mockAgents} invitations={mockInvitations} />
        </div>

        {/* Agent ↔ Org Assignments */}
        <div className="mt-6">
          <AgentOrgAssignments
            agents={agentOptions}
            organizations={orgOptions}
            assignments={mockAssignments}
          />
        </div>
      </div>
    </div>
  );
}
