import { ManageOrganizations } from "@/components/dashboard/admin/manage-organizations";
import { AgentOrgAssignments } from "@/components/dashboard/admin/agent-org-assignments";
import { db } from "@/db";
import { agentOrganizations, organizations, user } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { ROUTES } from "@/lib/routes";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Building2, FileText, ShieldCheck, Users } from "lucide-react";

export default async function OrganizationsPage() {
  const session = await getSessionUser();
  if (!session) redirect(ROUTES.SIGNIN);
  if (!["admin", "head_agent", "agent"].includes(session.role)) {
    redirect(ROUTES.DASHBOARD_USER);
  }

  const isAdmin = session.role === "admin";
  const orgRows = isAdmin
    ? await db
        .select({
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
          createdAt: organizations.createdAt,
          agentCount: sql<number>`(
            SELECT COUNT(*)::int FROM agent_organizations
            WHERE agent_organizations.organization_id = ${organizations.id}
          )`,
          claimCount: sql<number>`(
            SELECT COUNT(*)::int FROM claims
            WHERE claims.organization_id = ${organizations.id}
          )`,
          customerCount: sql<number>`(
            SELECT COUNT(DISTINCT policies.user_id)::int FROM policies
            WHERE policies.organization_id = ${organizations.id}
          )`,
        })
        .from(organizations)
        .orderBy(desc(organizations.createdAt))
    : await db
        .select({
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
          createdAt: organizations.createdAt,
          agentCount: sql<number>`(
            SELECT COUNT(*)::int FROM agent_organizations
            WHERE agent_organizations.organization_id = ${organizations.id}
          )`,
          claimCount: sql<number>`(
            SELECT COUNT(*)::int FROM claims
            WHERE claims.organization_id = ${organizations.id}
          )`,
          customerCount: sql<number>`(
            SELECT COUNT(DISTINCT policies.user_id)::int FROM policies
            WHERE policies.organization_id = ${organizations.id}
          )`,
        })
        .from(organizations)
        .innerJoin(
          agentOrganizations,
          eq(agentOrganizations.organizationId, organizations.id),
        )
        .where(eq(agentOrganizations.agentId, session.id))
        .orderBy(desc(organizations.createdAt));

  const formattedOrganizations = orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    code: org.code,
    agentCount: org.agentCount,
    claimCount: org.claimCount,
    createdAt: org.createdAt.toISOString(),
  }));

  const orgOptions = orgRows.map((org) => ({
    id: org.id,
    name: org.name,
    code: org.code,
  }));

  const [agentOptions, assignments] = isAdmin
    ? await Promise.all([
        db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(or(eq(user.role, "agent"), eq(user.role, "head_agent")))
          .orderBy(desc(user.createdAt)),
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
          .where(and(or(eq(user.role, "agent"), eq(user.role, "head_agent"))))
          .orderBy(desc(agentOrganizations.createdAt)),
      ])
    : [[], []];

  const formattedAssignments = assignments.map((assignment) => ({
    ...assignment,
    createdAt: assignment.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Organizations
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? "Manage insurers and assign agents or head agents across multiple organizations."
              : "View the organizations connected to your account."}
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-6">
            <ManageOrganizations organizations={formattedOrganizations} />
            <AgentOrgAssignments
              agents={agentOptions}
              organizations={orgOptions}
              assignments={formattedAssignments}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {orgRows.map((org) => (
              <div key={org.id} className="rounded-lg border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      {org.name}
                    </h2>
                    <p className="font-mono text-xs text-muted-foreground">
                      {org.code}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md border bg-background p-3">
                    <Users className="mb-2 h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{org.agentCount}</p>
                    <p className="text-xs text-muted-foreground">Staff</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <FileText className="mb-2 h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{org.claimCount}</p>
                    <p className="text-xs text-muted-foreground">Claims</p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <ShieldCheck className="mb-2 h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{org.customerCount}</p>
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

