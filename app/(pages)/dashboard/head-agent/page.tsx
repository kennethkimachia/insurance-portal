import {
  getUnassignedClaims,
  getAgentWorkloads,
  getBottleneckMetrics,
} from "@/app/actions/head-agent/manage-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { db } from "@/db";
import { agentOrganizations, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HeadAgentDashboardClient } from "./head-agent-dashboard-client";

export default async function HeadAgentDashboard() {
  const session = await getSessionUser();
  if (
    !session ||
    (session.role !== "head_agent" && session.role !== "admin")
  ) {
    redirect(ROUTES.SIGNIN);
  }

  // Get the head agent's first organization
  let orgId: string | null = null;

  if (session.role === "admin") {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);
    orgId = org?.id ?? null;
  } else {
    const [agentOrg] = await db
      .select({ organizationId: agentOrganizations.organizationId })
      .from(agentOrganizations)
      .where(eq(agentOrganizations.agentId, session.id))
      .limit(1);
    orgId = agentOrg?.organizationId ?? null;
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Head Agent Dashboard
          </h1>
          <p className="mt-4 text-muted-foreground">
            You are not assigned to any organization yet. Please contact your
            admin.
          </p>
        </div>
      </div>
    );
  }

  const [unassignedClaims, agentWorkloads, bottleneckMetrics] =
    await Promise.all([
      getUnassignedClaims(orgId),
      getAgentWorkloads(orgId),
      getBottleneckMetrics(orgId),
    ]);

  return (
    <HeadAgentDashboardClient
      organizationId={orgId}
      unassignedClaims={unassignedClaims}
      agents={agentWorkloads}
      bottleneckMetrics={bottleneckMetrics}
    />
  );
}
