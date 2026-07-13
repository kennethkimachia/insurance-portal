import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";
import { ROUTES } from "@/lib/routes";

const roleDashboard = {
  admin: ROUTES.DASHBOARD_ADMIN,
  head_agent: ROUTES.DASHBOARD_HEAD_AGENT,
  agent: ROUTES.DASHBOARD_AGENT,
  user: ROUTES.DASHBOARD_USER,
} as const;

export default async function HomePage() {
  const session = await getSessionUser();

  if (!session) {
    redirect(ROUTES.SIGNIN);
  }

  redirect(roleDashboard[session.role] ?? ROUTES.DASHBOARD_USER);
}