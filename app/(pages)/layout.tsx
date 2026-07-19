import { getSessionUser } from "@/lib/session";
import { db } from "@/db";
import { organizations, agentOrganizations, invitations, user } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { DashboardLayoutClient } from "./layout-client";
import { getActiveOrganizationId } from "@/lib/organization-access";
import { acceptInvitationByToken } from "@/app/actions/admin/manage-agents";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect(ROUTES.SIGNIN);
  }

  // Safety net: if user still has role "user" but has a pending invitation,
  // accept it now (catches cases where sign-up invitation acceptance failed)
  if (sessionUser.role === "user") {
    const [pendingInvitation] = await db
      .select({ token: invitations.token })
      .from(invitations)
      .where(
        and(
          eq(invitations.email, sessionUser.email.toLowerCase()),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    if (pendingInvitation) {
      const result = await acceptInvitationByToken(
        pendingInvitation.token,
        sessionUser.email
      );
      if (result.success) {
        // Redirect to refresh the session with updated role/org
        redirect(ROUTES.DASHBOARD);
      }
    }
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

  // Deduplicate organizations by id to prevent duplicate key errors
  orgs = [...new Map(orgs.map((o) => [o.id, o])).values()];

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
