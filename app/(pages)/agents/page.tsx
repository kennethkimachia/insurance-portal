import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";
import { db } from "@/db";
import { agentOrganizations, organizations, user } from "@/db/schema";
import { getActiveOrganizationId, requireOrganizationAccess } from "@/lib/organization-access";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/lib/session";
import { and, desc, eq, or, sql } from "drizzle-orm";
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

  const roster = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: agentOrganizations.createdAt,
      activeClaimCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM claims
        WHERE claims.assigned_agent_id = ${user.id}
          AND claims.organization_id = ${organizationId}
          AND claims.status NOT IN ('settled', 'rejected')
      )`,
      totalClaimCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM claims
        WHERE claims.assigned_agent_id = ${user.id}
          AND claims.organization_id = ${organizationId}
      )`,
    })
    .from(user)
    .innerJoin(agentOrganizations, eq(agentOrganizations.agentId, user.id))
    .where(
      and(
        eq(agentOrganizations.organizationId, organizationId),
        or(eq(user.role, "agent"), eq(user.role, "head_agent")),
      ),
    )
    .orderBy(desc(agentOrganizations.createdAt));

  const [agentOptions, orgOptions, assignments] =
    session.role === "admin"
      ? await Promise.all([
          db
            .select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(or(eq(user.role, "agent"), eq(user.role, "head_agent")))
            .orderBy(desc(user.createdAt)),
          db
            .select({ id: organizations.id, name: organizations.name, code: organizations.code })
            .from(organizations)
            .orderBy(desc(organizations.createdAt)),
          db
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
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
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
                className="grid gap-4 px-4 py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] md:items-center"
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
            assignments={assignments.map((assignment) => ({
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
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

