import "server-only";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, resolveDemoRole } from "./demo-role-policy";
import type { Role } from "./permissions";

export async function getDemoRole(account: {
  role: Role | null;
  clerkUserId: string;
  clerkSessionId: string;
}) {
  return resolveDemoRole(
    account,
    (await cookies()).get(DEMO_ROLE_COOKIE)?.value,
    process.env,
  );
}
