import {
  getUnassignedClaims,
  getAgentWorkloads,
  getBottleneckMetrics,
  getManagedClaims,
} from "@/app/actions/head-agent/manage-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getActiveOrganizationId } from "@/lib/organization-access";
import { HeadAgentDashboardClient } from "./head-agent-dashboard-client";

export default async function HeadAgentDashboard() {
  const session = await getSessionUser();
  if (!session || (session.role !== "head_agent" && session.role !== "admin")) {
    redirect(ROUTES.SIGNIN);
  }

  const orgId = await getActiveOrganizationId(session);

  if (!orgId) {
    return (
      <div className="min-h-[calc(100svh-4rem)] bg-background">
        <div className="portal-page">
          <h1 className="portal-heading">
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

  const [unassignedClaims, agentWorkloads, bottleneckMetrics, managedClaims] =
    await Promise.all([
      getUnassignedClaims(orgId),
      getAgentWorkloads(orgId),
      getBottleneckMetrics(orgId),
      getManagedClaims(orgId),
    ]);

  return (
    <HeadAgentDashboardClient
      key={orgId}
      organizationId={orgId}
      unassignedClaims={unassignedClaims}
      agents={agentWorkloads}
      bottleneckMetrics={bottleneckMetrics}
      managedClaims={managedClaims}
    />
  );
}
