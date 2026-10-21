import { getMyAssignedClaims } from "@/app/actions/agent/manage-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { AgentDashboardClient } from "./agent-dashboard-client";
import { getActiveOrganizationId } from "@/lib/organization-access";

export default async function AgentDashboard() {
  const session = await getSessionUser();
  if (
    !session ||
    (session.role !== "agent" &&
      session.role !== "head_agent" &&
      session.role !== "admin")
  ) {
    redirect(ROUTES.SIGNIN);
  }

  const claims = await getMyAssignedClaims();

  return (
    <AgentDashboardClient
      key={await getActiveOrganizationId(session)}
      claims={claims}
      agentName={session.name}
    />
  );
}
