"use server";

import { db } from "@/db";
import { agentOrganizations, organizations } from "@/db/schema";
import type { SessionUser } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function canAccessOrganization(
  session: SessionUser,
  organizationId: string,
): Promise<boolean> {
  if (session.role === "admin") return true;
  if (session.role === "user") return session.organizationId === organizationId;

  const [membership] = await db
    .select({ id: agentOrganizations.id })
    .from(agentOrganizations)
    .where(
      and(
        eq(agentOrganizations.agentId, session.id),
        eq(agentOrganizations.organizationId, organizationId),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

export async function requireOrganizationAccess(
  session: SessionUser,
  organizationId: string,
): Promise<void> {
  if (!(await canAccessOrganization(session, organizationId))) {
    throw new Error("You do not have access to this organization");
  }
}

export async function getActiveOrganizationId(
  session: SessionUser,
): Promise<string | null> {
  const requestedId = (await cookies()).get("active_organization_id")?.value;
  if (requestedId && (await canAccessOrganization(session, requestedId))) {
    return requestedId;
  }

  if (session.role === "user") return session.organizationId;

  if (session.role === "admin") {
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1);
    return organization?.id ?? null;
  }

  const [membership] = await db
    .select({ organizationId: agentOrganizations.organizationId })
    .from(agentOrganizations)
    .where(eq(agentOrganizations.agentId, session.id))
    .limit(1);
  return membership?.organizationId ?? null;
}
