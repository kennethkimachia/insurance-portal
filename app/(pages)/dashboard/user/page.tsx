import { getMyClaims, getMyPolicies, getMyNotifications, getMyClaimProgress, getMyClaimAgent, getMyClaimAttachments } from "@/app/actions/user/my-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { UserDashboardClient } from "./user-dashboard-client";

export default async function UserDashboard() {
  const session = await getSessionUser();
  if (!session) {
    redirect(ROUTES.SIGNIN);
  }

  const [claims, policies] = await Promise.all([
    getMyClaims(),
    getMyPolicies(),
  ]);

  // Get progress, agent, and attachments for the first claim
  let firstClaimProgress: Awaited<ReturnType<typeof getMyClaimProgress>> = [];
  let firstClaimAgent: Awaited<ReturnType<typeof getMyClaimAgent>> = null;
  let firstClaimAttachments: Awaited<ReturnType<typeof getMyClaimAttachments>> = [];

  if (claims.length > 0) {
    [firstClaimProgress, firstClaimAgent, firstClaimAttachments] = await Promise.all([
      getMyClaimProgress(claims[0].id),
      getMyClaimAgent(claims[0].id),
      getMyClaimAttachments(claims[0].id),
    ]);
  }

  return (
    <UserDashboardClient
      userName={session.name}
      claims={claims}
      policies={policies}
      initialProgress={firstClaimProgress}
      initialAgent={firstClaimAgent}
      initialAttachments={firstClaimAttachments}
    />
  );
}
