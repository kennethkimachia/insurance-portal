import {
  getMyClaims,
  getMyPolicies,
  getMyNotifications,
} from "@/app/actions/user/my-claims";
import { requireSession } from "@/lib/session";
import { UserDashboardClient } from "./user-dashboard-client";

export default async function UserDashboard() {
  const session = await requireSession();
  const [claims, policies, notifications] = await Promise.all([
    getMyClaims(),
    getMyPolicies(),
    getMyNotifications(),
  ]);
  return (
    <UserDashboardClient
      userName={session.name}
      claims={claims}
      policies={policies}
      notifications={notifications}
    />
  );
}
