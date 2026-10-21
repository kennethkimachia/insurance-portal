import { RoleUpdateControls } from "@/components/auth/role-update-controls";
import { clerkRoleOperations, portalActors } from "@/db/schema";
import { hydrateAssignments, listPortalStaff } from "@/lib/clerk-directory";
export const dynamic = "force-dynamic";

import { SystemOverview } from "@/components/dashboard/admin/system-overview";
import { ManageOrganizations } from "@/components/dashboard/admin/manage-organizations";
import { ManageAgents } from "@/components/dashboard/admin/manage-agents";
import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";
import { getOrganizations } from "@/app/actions/admin/manage-organization";
import { db } from "@/db";
import {
  organizations,
  agentOrganizations,
  claims,
  auditEvents,
} from "@/db/schema";
import { eq, sql, desc, notInArray, and } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { permissions, requirePermission } from "@/lib/permissions";
import { listPortalInvitations } from "@/lib/invitations";
import { getEmailMode } from "@/lib/email";

export default async function AdminDashboard() {
  const actor = await requireSession();
  requirePermission(actor.role, permissions.USER_MANAGE);
  const orgs = await getOrganizations();
  const cancelledRoleUpdates = await db.select({ operation: clerkRoleOperations, actor: portalActors }).from(clerkRoleOperations)
    .innerJoin(portalActors, eq(portalActors.id, clerkRoleOperations.actorId))
    .where(and(eq(clerkRoleOperations.status, "cancelled"), eq(portalActors.suspensionReason, "Cancelled Clerk role update: review role before reinstatement.")))
    .orderBy(desc(clerkRoleOperations.completedAt));
  const pendingRoleUpdates = await db.select().from(clerkRoleOperations).where(notInArray(clerkRoleOperations.status, ["applied", "cancelled"])).orderBy(desc(clerkRoleOperations.createdAt));

  // Fetch real agents
  const agents = await listPortalStaff();

  // Get organization names for each agent
  const agentsWithOrgs = await Promise.all(
    agents.map(async (agent) => {
      if (agent.role === "admin") {
        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          clerkBanned: agent.banned,
          emailVerified: agent.emailVerified,
          role: agent.role as "admin" | "head_agent" | "agent",
          organizationName: undefined,
          createdAt: agent.createdAt.toISOString().split("T")[0],
          suspendedAt: agent.suspendedAt?.toISOString() ?? null,
          pendingRoleOperationId: agent.pendingRoleOperationId,
        };
      }

      const [agentOrg] = await db
        .select({ name: organizations.name })
        .from(agentOrganizations)
        .innerJoin(
          organizations,
          eq(organizations.id, agentOrganizations.organizationId),
        )
        .where(eq(agentOrganizations.agentId, agent.id))
        .limit(1);

      return {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        clerkBanned: agent.banned,
        emailVerified: agent.emailVerified,
        role: agent.role as "admin" | "head_agent" | "agent",
        organizationName: agentOrg?.name,
        createdAt: agent.createdAt.toISOString().split("T")[0],
        suspendedAt: agent.suspendedAt?.toISOString() ?? null,
        pendingRoleOperationId: agent.pendingRoleOperationId,
      };
    }),
  );

  const formattedInvitations = await listPortalInvitations(actor, "staff");
  const accessHistory = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(30);

  // Fetch real assignments
  const assignments = await db
    .select({
      id: agentOrganizations.id,
      agentId: agentOrganizations.agentId,
      organizationId: agentOrganizations.organizationId,
      organizationName: organizations.name,
      organizationCode: organizations.code,
      createdAt: agentOrganizations.createdAt,
    })
    .from(agentOrganizations)
    .innerJoin(
      organizations,
      eq(organizations.id, agentOrganizations.organizationId),
    )
    .orderBy(desc(agentOrganizations.createdAt));

  const formattedAssignments = (await hydrateAssignments(assignments)).map((a) => ({
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
      (i) => i.state === "pending",
    ).length,
  };

  const orgOptions = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
  }));

  const agentOptions = agentsWithOrgs
    .filter((a) => a.role !== "admin" && !a.suspendedAt && !a.pendingRoleOperationId && !a.clerkBanned && a.emailVerified)
    .map((a) => ({ id: a.id, name: a.name, email: a.email }));

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="portal-heading">
            Admin Dashboard
          </h1>
          <p className="portal-intro">
            Manage organizations, agents, and system-wide settings.
          </p>
        </div>

        <p className="mb-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          The portal operator administers access to separate insurance
          organizations. Email mode:{" "}
          <strong className="text-foreground">{getEmailMode()}</strong>.{" "}
          {getEmailMode() === "sandbox"
            ? "Messages go to the configured test inbox; recipients do not receive them."
            : getEmailMode() === "disabled"
              ? "Configure sandbox delivery before demonstrating invitation activation."
              : "Provider acceptance is recorded; recipient delivery remains unconfirmed."}
        </p>

        {pendingRoleUpdates.length > 0 && <section className="portal-panel mb-6 space-y-4 p-5">
          <h2 className="font-semibold">Pending access updates</h2>
          {pendingRoleUpdates.map((operation) => <div key={operation.id} className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">Account {operation.actorId.slice(0, 8)} ? {operation.previousRole ?? "Unassigned"} ? {operation.desiredRole} ? {operation.status}</p>
            {operation.lastError && <p className="text-sm text-muted-foreground">{operation.lastError}</p>}
            <RoleUpdateControls id={operation.id} administrator />
          </div>)}
        </section>}
        {cancelledRoleUpdates.length > 0 && <section className="portal-panel mb-6 space-y-4 p-5">
          <h2 className="font-semibold">Cancelled updates awaiting review</h2>
          <p className="text-sm text-muted-foreground">These accounts remain suspended. Review the restored role before reinstating access.</p>
          {cancelledRoleUpdates.map(({ operation, actor: target }) => <div key={operation.id} className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">Account {target.id.slice(0, 8)} ? Restored role: {operation.previousRole ?? "Unassigned"}</p>
            <RoleUpdateControls id={operation.id} cancelledActorId={target.id} administrator />
          </div>)}
        </section>}
        {/* System Overview */}
        <SystemOverview
          stats={stats}
          organizations={orgs.map((org) => ({
            id: org.id,
            agentCount: org.agentCount,
            claimCount: org.claimCount,
          }))}
        />

        {/* Organizations + Agents */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ManageOrganizations organizations={orgs} />
          <ManageAgents
            agents={agentsWithOrgs}
            currentActorId={actor.id}
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
        <section className="mt-6 portal-panel p-5 sm:p-6">
          <h2 className="font-semibold">Recent access changes</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Append-only records of staff and enrollment access changes.
          </p>
          {accessHistory.length ? (
            <div className="space-y-2">
              {accessHistory.map((event) => (
                <div
                  key={event.id}
                  className="portal-row flex flex-wrap justify-between gap-3 border-t py-4 text-sm"
                >
                  <span>
                    {event.action.replaceAll("_", " ")} · actor{" "}
                    {event.actorId?.slice(0, 8) || "system"}
                    {event.targetUserId &&
                      ` · account ${event.targetUserId.slice(0, 8)}`}
                    {typeof event.details.reason === "string" &&
                      ` · ${event.details.reason}`}
                  </span>
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {event.createdAt.toLocaleString("en-KE", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No access changes recorded yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
