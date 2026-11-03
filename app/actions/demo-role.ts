"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentOrganizations, organizations, policies, policyholderEnrollments } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireCurrentActor } from "@/lib/transaction-identity";
import { getActiveOrganizationId } from "@/lib/organization-access";
import { createPortalPolicyNumber } from "@/lib/invitation-policy";
import { parsePortalRole } from "@/lib/clerk-profile-policy";
import { canSwitchDemoRoles, DEMO_ROLE_COOKIE } from "@/lib/demo-role-policy";
import { actionError } from "@/lib/action-errors";

export async function switchDemoRole(requestedRole: string) {
  try {
    const session = await requireSession();
    if (!session.demo || !canSwitchDemoRoles(session.demo.accountRole, process.env))
      throw new Error("Demo role switching is available to staff in local development.");

    const role = parsePortalRole(requestedRole);
    if (!role && requestedRole !== "account") throw new Error("Choose a valid demo role.");

    const activeOrganizationId = await getActiveOrganizationId(session);
    const organizationId = await db.transaction(async (tx) => {
      await requireCurrentActor(tx, session);
      if (!role) return null;

      // Keep the same policies and organization when switching back and forth.
      const [enrollment] = await tx.select().from(policyholderEnrollments)
        .where(eq(policyholderEnrollments.actorId, session.id)).limit(1);
      let orgId = enrollment?.organizationId ?? activeOrganizationId;
      if (!orgId) {
        await tx.insert(organizations).values({ name: "Demo Insurance", code: "DEMO" })
          .onConflictDoNothing({ target: organizations.code });
        const [organization] = await tx.select().from(organizations)
          .where(eq(organizations.code, "DEMO")).limit(1);
        orgId = organization.id;
      }

      await tx.insert(agentOrganizations).values({ agentId: session.id, organizationId: orgId })
        .onConflictDoNothing();

      if (role === "user") {
        await tx.insert(policyholderEnrollments).values({ actorId: session.id, organizationId: orgId })
          .onConflictDoNothing();
        await tx.insert(policies).values(
          (["motor", "burglary"] as const).map((policyType) => ({
            userId: session.id,
            organizationId: orgId,
            policyType,
            policyNumber: createPortalPolicyNumber("demo", policyType),
            source: "demo",
            status: "active",
          })),
        ).onConflictDoNothing({ target: [policies.userId, policies.policyType] });
      }
      return orgId;
    });

    const store = await cookies();
    if (role) {
      store.set(DEMO_ROLE_COOKIE, JSON.stringify({
        role, clerkUserId: session.clerkUserId, clerkSessionId: session.clerkSessionId,
      }), { httpOnly: true, sameSite: "lax", path: "/" });
      if (organizationId) store.set("active_organization_id", organizationId, {
        sameSite: "lax", path: "/", maxAge: 31536000,
      });
    } else {
      store.delete(DEMO_ROLE_COOKIE);
    }
    revalidatePath("/", "layout");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Could not switch roles. Please retry.") };
  }
}
