"use server";

import { getActorProfiles, profileFor } from "@/lib/clerk-directory";
import { db } from "@/db";
import {
  organizations,
  policies,
  agentOrganizations,
  auditEvents,
} from "@/db/schema";
import {
  getActiveOrganizationId,
  requireOrganizationAccess,
} from "@/lib/organization-access";
import { permissions, requirePermission } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { desc, eq, and, getTableColumns, sql } from "drizzle-orm";
import { requireCurrentActor } from "@/lib/transaction-identity";
import {
  policyProfileSchema,
  type PolicyProfileInput,
} from "@/lib/schemas/policy-profile";
import { actionError } from "@/lib/action-errors";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getVisiblePolicies() {
  const session = await requireSession();
  requirePermission(session.role, permissions.POLICY_READ);

  const base = db
    .select({
      ...getTableColumns(policies),
      id: policies.id,
      policyNumber: policies.policyNumber,
      policyType: policies.policyType,
      organizationId: policies.organizationId,
      organizationName: organizations.name,
      organizationCode: organizations.code,
      userId: policies.userId,
      createdAt: policies.createdAt,
    })
    .from(policies)
    .innerJoin(organizations, eq(organizations.id, policies.organizationId));

  let result;
  if (session.role === "user") {
    result = await base
      .where(eq(policies.userId, session.id))
      .orderBy(desc(policies.createdAt));
  } else {
    const organizationId = await getActiveOrganizationId(session);
    if (!organizationId) return [];
    await requireOrganizationAccess(session, organizationId);
    result = await base
      .where(eq(policies.organizationId, organizationId))
      .orderBy(desc(policies.createdAt));
  }

  const profiles = await getActorProfiles(result.map((p) => p.userId));
  return result.map((policy) => ({
    policyholderName: profileFor(profiles, policy.userId).name,
    policyholderEmail: profileFor(profiles, policy.userId).email,
    ...policy,
    createdAt: policy.createdAt.toISOString(),
  }));
}

export async function updatePolicyProfile(
  policyId: string,
  expectedVersion: number,
  input: PolicyProfileInput,
) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.POLICY_UPDATE);
    const id = z.string().uuid().parse(policyId);
    const parsed = policyProfileSchema.safeParse(input);
    if (!parsed.success)
      return {
        success: false as const,
        error: "Check the policy profile.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    const data = parsed.data;
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, id))
      .limit(1);
    if (!policy) throw new Error("Policy not found or access denied");
    await requireOrganizationAccess(actor, policy.organizationId);
    await db.transaction(async (tx) => {
      const identity = await requireCurrentActor(tx, actor);
      const [current] = await tx
        .select()
        .from(policies)
        .where(eq(policies.id, id))
        .for("update")
        .limit(1);
      if (
        !current ||
        current.organizationId !== policy.organizationId ||
        current.version !== expectedVersion
      )
        throw new Error("This policy changed. Refresh before editing it.");
      if (identity.role !== "admin") {
        const [membership] = await tx
          .select()
          .from(agentOrganizations)
          .where(
            and(
              eq(agentOrganizations.agentId, actor.id),
              eq(agentOrganizations.organizationId, current.organizationId),
            ),
          )
          .for("share")
          .limit(1);
        if (!membership)
          throw new Error(
            "Your organization access changed. Refresh before editing.",
          );
      }
      const values = {
        ...data,
        insurerReference: data.insurerReference || null,
        coverageStart: data.coverageStart || null,
        coverageEnd: data.coverageEnd || null,
      };
      await tx
        .update(policies)
        .set({ ...values, version: sql`${policies.version} + 1` })
        .where(eq(policies.id, id));
      await tx
        .insert(auditEvents)
        .values({
          organizationId: current.organizationId,
          actorId: actor.id,
          targetUserId: current.userId,
          action: "policy_profile_updated",
          details: {
            policyId: id,
            previousVersion: current.version,
            previous: {
              status: current.status,
              source: current.source,
              insurerReference: current.insurerReference,
              coverageStart: current.coverageStart,
              coverageEnd: current.coverageEnd,
              insuredAsset: current.insuredAsset,
              coverageSummary: current.coverageSummary,
            },
            updated: values,
          },
        });
    });
    revalidatePath("/policies");
    revalidatePath("/claim-forms");
    revalidatePath("/dashboard/user");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(error, "Could not update this policy profile."),
    };
  }
}
