import { getSessionUser } from "@/lib/session";
import { db } from "@/db";
import { organizations, agentOrganizations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { DashboardLayoutClient } from "./layout-client";
import { getActiveOrganizationId } from "@/lib/organization-access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect(ROUTES.SIGNIN);
  }

  // Fetch organizations based on role
  let orgs: { id: string; name: string; code: string }[] = [];

  if (sessionUser.role === "admin") {
    // Admin sees all organizations
    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt));
    orgs = allOrgs;
  } else if (
    sessionUser.role === "agent" ||
    sessionUser.role === "head_agent"
  ) {
    // Agents see their assigned organizations
    const agentOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
      })
      .from(organizations)
      .innerJoin(
        agentOrganizations,
        eq(agentOrganizations.organizationId, organizations.id)
      )
      .where(eq(agentOrganizations.agentId, sessionUser.id));
    orgs = agentOrgs;
  } else if (sessionUser.organizationId) {
    // User sees their organization
    const [userOrg] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
      })
      .from(organizations)
      .where(eq(organizations.id, sessionUser.organizationId))
      .limit(1);
    if (userOrg) orgs = [userOrg];
  }

  const activeOrganizationId = await getActiveOrganizationId(sessionUser);
  return (
    <DashboardLayoutClient
      user={{
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
      }}
      organizations={orgs}
      initialOrganizationId={activeOrganizationId ?? undefined}
    >
      {children}
    </DashboardLayoutClient>
  );
}
