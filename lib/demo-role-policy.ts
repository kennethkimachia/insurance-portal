import { parsePortalRole } from "./clerk-profile-policy";
import type { Role } from "./permissions";

export const DEMO_ROLE_COOKIE = "portal_demo_role";
export const DEMO_ROLES: { role: Role; label: string }[] = [
  { role: "user", label: "Policyholder" },
  { role: "agent", label: "Agent" },
  { role: "head_agent", label: "Claims manager" },
  { role: "admin", label: "Platform administrator" },
];

export function canSwitchDemoRoles(role: Role | null) {
  return role === "admin" || role === "head_agent" || role === "agent";
}

export function resolveDemoRole(
  account: { role: Role | null; clerkUserId: string; clerkSessionId: string },
  cookie: string | undefined,
): Role | null {
  if (!cookie || !canSwitchDemoRoles(account.role)) return null;
  try {
    const state = JSON.parse(cookie);
    if (state.clerkUserId !== account.clerkUserId ||
        state.clerkSessionId !== account.clerkSessionId) return null;
    return parsePortalRole(state.role);
  } catch {
    return null;
  }
}

export function isDemoAgent(
  session: { id: string; demo?: { active: boolean } },
  agentId: string,
) {
  return session.demo?.active === true && session.id === agentId;
}
