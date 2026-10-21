import { hydrateActors, hydrateAssignments, listPortalStaff } from "@/lib/clerk-directory";
import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";
import { db } from "@/db";
import { agentOrganizations, organizations, portalActors } from "@/db/schema";
import { getActiveOrganizationId, requireOrganizationAccess } from "@/lib/organization-access";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/lib/session";
import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, Mail, Shield, UserRoundCheck } from "lucide-react";

export default async function AgentsPage() {
  const session = await getSessionUser();
  if (!session) redirect(ROUTES.SIGNIN);
  if (session.role !== "admin" && session.role !== "head_agent") {
    redirect(ROUTES.DASHBOARD_AGENT);
  }

  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) {
    return (
      <PageShell title="Agents" description="Select or join an organization to view agents.">
        <EmptyPanel message="No organization is active." />
      </PageShell>
    );
  }

  await requireOrganizationAccess(session, organizationId);

  const rosterRows = await db
    .select({
      id: portalActors.id,
      createdAt: agentOrganizations.createdAt,
      activeClaimCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM claims
        WHERE claims.assigned_agent_id = ${portalActors.id}
          AND claims.organization_id = ${organizationId}
          AND claims.status NOT IN ('settled', 'rejected')
      )`,
      totalClaimCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM claims
        WHERE claims.assigned_agent_id = ${portalActors.id}
          AND claims.organization_id = ${organizationId}
      )`,
    })
    .from(portalActors)
    .innerJoin(agentOrganizations, eq(agentOrganizations.agentId, portalActors.id))
    .where(
      and(
        eq(agentOrganizations.organizationId, organizationId),
      ),
    )
    .orderBy(desc(agentOrganizations.createdAt));

  const roster = (await hydrateActors(rosterRows)).filter((row) => row.role === "agent" || row.role === "head_agent");

  const [agentOptions, orgOptions, assignments] =
    session.role === "admin"
      ? await Promise.all([
          listPortalStaff().then((rows) => rows.filter((row) => row.role !== "admin" && !row.suspendedAt && !row.pendingRoleOperationId && row.emailVerified && !row.banned)),
          db
            .select({ id: organizations.id, name: organizations.name, code: organizations.code })
            .from(organizations)
            .orderBy(desc(organizations.createdAt)),
          db
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
            .orderBy(desc(agentOrganizations.createdAt)),
        ])
      : [[], [], []];

  return (
    <PageShell
      title="Agents"
      description="Agents and head agents assigned to the active organization."
    >
      <div className="portal-panel overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-4 portal-table-head md:grid">
          <span>Agent</span>
          <span>Role</span>
          <span>Claims</span>
          <span>Assigned</span>
        </div>
        <div className="divide-y">
          {roster.length === 0 ? (
            <EmptyPanel message="No agents are assigned to this organization yet." />
          ) : (
            roster.map((agent) => (
              <div
                key={agent.id}
                className="portal-row grid gap-4 px-5 py-5 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserRoundCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {agent.name}
                    </p>
                    <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{agent.email}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <Badge variant={agent.role === "head_agent" ? "default" : "secondary"}>
                    {agent.role === "head_agent" ? "Head Agent" : "Agent"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <BriefcaseBusiness className="h-3 w-3" />
                    {agent.activeClaimCount} active
                  </Badge>
                  <Badge variant="secondary">{agent.totalClaimCount} total</Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  {agent.createdAt.toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {session.role === "admin" && (
        <div className="mt-6">
          <AgentOrgAssignments
            agents={agentOptions}
            organizations={orgOptions}
            assignments={(await hydrateAssignments(assignments)).map((assignment) => ({
              ...assignment,
              createdAt: assignment.createdAt.toISOString(),
            }))}
          />
        </div>
      )}
    </PageShell>
  );
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page">
        <div className="mb-8">
          <h1 className="portal-heading">
            {title}
          </h1>
          <p className="portal-intro">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="portal-empty">
      {message}
    </div>
  );
}

