"use server";

import { db } from "@/db";
import { organizations, auditEvents } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireCurrentActor } from "@/lib/transaction-identity";
import { permissions, requirePermission } from "@/lib/permissions";
import { actionError } from "@/lib/action-errors";
import { eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getOrganizations() {
  const actor = await requireSession();
  requirePermission(actor.role, permissions.ORGANIZATION_WRITE);
  const results = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
      createdAt: organizations.createdAt,
      agentCount: sql<number>`(SELECT count(*)::int FROM agent_organizations WHERE agent_organizations.organization_id = ${organizations.id})`,
      claimCount: sql<number>`(SELECT count(*)::int FROM claims WHERE claims.organization_id = ${organizations.id} AND claims.status <> 'draft')`,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));
  return results.map((org) => ({
    ...org,
    createdAt: org.createdAt.toISOString(),
  }));
}

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(255),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers"),
});

export async function createOrganization(formData: FormData) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.ORGANIZATION_WRITE);
    const parsed = createOrganizationSchema.safeParse({
      name: formData.get("name"),
      code: String(formData.get("code") || "").toUpperCase(),
    });
    if (!parsed.success)
      return {
        success: false,
        error: "Check the organization details",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    const organization = await db.transaction(async (tx) => {
      await requireCurrentActor(tx, actor);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`organization:${parsed.data.code}`}))`,
      );
      const [existing] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.code, parsed.data.code))
        .limit(1);
      if (existing)
        throw new Error("An organization with this code already exists");
      const [created] = await tx
        .insert(organizations)
        .values(parsed.data)
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.id,
          organizationId: created.id,
          action: "organization_created",
          details: { name: created.name, code: created.code },
        });
      return created;
    });
    revalidatePath("/dashboard", "layout");
    return { success: true, organization };
  } catch (error) {
    return {
      success: false,
      error: actionError(
        error,
        "Could not create this organization. Please retry.",
      ),
    };
  }
}
