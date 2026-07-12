"use server";

import { db } from "@/db";
import { organizations, policies, user } from "@/db/schema";
import { getActiveOrganizationId, requireOrganizationAccess } from "@/lib/organization-access";
import { permissions, requirePermission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { desc, eq } from "drizzle-orm";

export async function getVisiblePolicies() {
  const session = await requireSession();
  requirePermission(session.role, permissions.POLICY_READ);

  const base = db
    .select({
      id: policies.id,
      policyNumber: policies.policyNumber,
      policyType: policies.policyType,
      organizationId: policies.organizationId,
      organizationName: organizations.name,
      organizationCode: organizations.code,
      policyholderName: user.name,
      policyholderEmail: user.email,
      userId: policies.userId,
      createdAt: policies.createdAt,
    })
    .from(policies)
    .innerJoin(organizations, eq(organizations.id, policies.organizationId))
    .innerJoin(user, eq(user.id, policies.userId));

  let result;
  if (session.role === "user") {
    result = await base.where(eq(policies.userId, session.id)).orderBy(desc(policies.createdAt));
  } else {
    const organizationId = await getActiveOrganizationId(session);
    if (!organizationId) return [];
    await requireOrganizationAccess(session, organizationId);
    result = await base.where(eq(policies.organizationId, organizationId)).orderBy(desc(policies.createdAt));
  }

  return result.map((policy) => ({
    ...policy,
    createdAt: policy.createdAt.toISOString(),
  }));
}
