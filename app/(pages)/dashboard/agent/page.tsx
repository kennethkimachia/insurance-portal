import { getMyAssignedClaims, getClaimTimeline } from "@/app/actions/agent/manage-claims";
import { getProgressSteps } from "@/app/actions/agent/progress-steps";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { AgentDashboardClient } from "./agent-dashboard-client";

export default async function AgentDashboard() {
  const session = await getSessionUser();
  if (!session || (session.role !== "agent" && session.role !== "head_agent" && session.role !== "admin")) {
    redirect(ROUTES.SIGNIN);
  }

  const claims = await getMyAssignedClaims();

  // If there are claims, fetch timeline and progress for the first one
  let initialTimeline: Awaited<ReturnType<typeof getClaimTimeline>> = [];
  let initialProgressSteps: Awaited<ReturnType<typeof getProgressSteps>> = [];

  if (claims.length > 0) {
    [initialTimeline, initialProgressSteps] = await Promise.all([
      getClaimTimeline(claims[0].id),
      getProgressSteps(claims[0].id),
    ]);
  }

  return (
    <AgentDashboardClient
      claims={claims}
      agentName={session.name}
      initialTimeline={initialTimeline}
      initialProgressSteps={initialProgressSteps}
    />
  );
}
