import { NextResponse } from "next/server";
import type { Role } from "./permissions";
import { ROUTES } from "./routes";

const roleDashboard: Record<Role, string> = {
  admin: ROUTES.DASHBOARD_ADMIN,
  head_agent: ROUTES.DASHBOARD_HEAD_AGENT,
  agent: ROUTES.DASHBOARD_AGENT,
  user: ROUTES.DASHBOARD_USER,
};

export function dashboardRedirect(requestUrl: string, role?: Role) {
  const destination = role ? roleDashboard[role] : "/auth/continue";
  const response = NextResponse.redirect(new URL(destination, requestUrl));
  // A role may change between requests, including through the demo switcher.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
