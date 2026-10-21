import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import type { Role } from "@/lib/permissions";

export async function requireDashboardRole(role: Role) {
  const identity = await getSessionUser();
  if (!identity) redirect("/auth/continue");
  if (identity.role !== "admin" && identity.role !== role) redirect("/dashboard");
}
