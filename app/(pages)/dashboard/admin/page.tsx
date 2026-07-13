import { SystemOverview } from "@/components/dashboard/admin/system-overview";
import { ManageOrganizations } from "@/components/dashboard/admin/manage-organizations";
import { ManageAgents } from "@/components/dashboard/admin/manage-agents";
import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";
import { getOrganizations } from "@/app/actions/admin/manage-organization";
import { db } from "@/db";
import {
  user,
  organizations,
  agentOrganizations,
  claims,
  invitations,
} from "@/db/schema";
import { eq, sql, desc, and, or } from "drizzle-orm";

export default async function AdminDashboard() {
  const orgs = await getOrganizations();

  // Fetch real agents
  const agents = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(or(eq(user.role, "agent"), eq(user.role, "head_agent"), eq(user.role, "admin")))
    .orderBy(desc(user.createdAt));

  // Get organization names for each agent
  const agentsWithOrgs = await Promise.all(
    agents.map(async (agent) => {
      if (agent.role === "admin") {
        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role as "admin" | "head_agent" | "agent",
          organizationName: undefined,
          createdAt: agent.createdAt.toISOString().split("T")[0],
        };
      }

      const [agentOrg] = await db
        .select({ name: organizations.name })
        .from(agentOrganizations)
        .innerJoin(
          organizations,
          eq(organizations.id, agentOrganizations.organizationId)
        )
        .where(eq(agentOrganizations.agentId, agent.id))
        .limit(1);

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agent.role as "admin" | "head_agent" | "agent",
        organizationName: agentOrg?.name,
        createdAt: agent.createdAt.toISOString().split("T")[0],
      };
    })
  );

  // Fetch real invitations
  const invitationsList = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .orderBy(desc(invitations.createdAt))
    .limit(20);

  const formattedInvitations = invitationsList.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role as "admin" | "head_agent" | "agent",
    status: inv.status as "pending" | "accepted" | "expired",
    createdAt: inv.createdAt.toISOString().split("T")[0],
  }));

  // Fetch real assignments
  const assignments = await db
    .select({
      id: agentOrganizations.id,
      agentId: agentOrganizations.agentId,
      agentName: user.name,
      agentEmail: user.email,
      organizationId: agentOrganizations.organizationId,
      organizationName: organizations.name,
      organizationCode: organizations.code,
      createdAt: agentOrganizations.createdAt,
    })
    .from(agentOrganizations)
    .innerJoin(user, eq(user.id, agentOrganizations.agentId))
    .innerJoin(
      organizations,
      eq(organizations.id, agentOrganizations.organizationId)
    )
    .orderBy(desc(agentOrganizations.createdAt));

  const formattedAssignments = assignments.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString().split("T")[0],
  }));

  // Build stats
  const [totalClaimsResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(claims);

  const stats = {
    totalOrganizations: orgs.length,
    totalAgents: agentsWithOrgs.filter((a) => a.role !== "admin").length,
    totalClaims: totalClaimsResult?.count ?? 0,
    pendingInvitations: formattedInvitations.filter(
      (i) => i.status === "pending"
    ).length,
  };

  const orgOptions = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
  }));

  const agentOptions = agentsWithOrgs
    .filter((a) => a.role !== "admin")
    .map((a) => ({ id: a.id, name: a.name, email: a.email }));

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage organizations, agents, and system-wide settings.
          </p>
        </div>

        {/* System Overview */}
        <SystemOverview stats={stats} />

        {/* Organizations + Agents */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ManageOrganizations organizations={orgs} />
          <ManageAgents
            agents={agentsWithOrgs}
            invitations={formattedInvitations}
            organizations={orgOptions}
          />
        </div>

        {/* Agent ↔ Org Assignments */}
        <div className="mt-6">
          <AgentOrgAssignments
            agents={agentOptions}
            organizations={orgOptions}
            assignments={formattedAssignments}
          />
        </div>
      </div>
    </div>
  );
}
