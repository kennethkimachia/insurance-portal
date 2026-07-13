import {
  getUnassignedClaims,
  getAgentWorkloads,
  getBottleneckMetrics,
} from "@/app/actions/head-agent/manage-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getActiveOrganizationId } from "@/lib/organization-access";
import { HeadAgentDashboardClient } from "./head-agent-dashboard-client";

export default async function HeadAgentDashboard() {
  const session = await getSessionUser();
  if (
    !session ||
    (session.role !== "head_agent" && session.role !== "admin")
  ) {
    redirect(ROUTES.SIGNIN);
  }

  const orgId = await getActiveOrganizationId(session);

  if (!orgId) {
    return (
      <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
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
