"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { organizations, agentOrganizations, claims } from "@/db/schema";
import { headers } from "next/headers";
import { eq, sql, desc } from "drizzle-orm";
import { z } from "zod";

export async function getOrganizations() {
  const results = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.code,
      createdAt: organizations.createdAt,
      agentCount: sql<number>`(
        SELECT COUNT(*)::int FROM agent_organizations
        WHERE agent_organizations.organization_id = ${organizations.id}
      )`,
      claimCount: sql<number>`(
        SELECT COUNT(*)::int FROM claims
        WHERE claims.organization_id = ${organizations.id}
      )`,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  return results.map((org) => ({
    id: org.id,
    name: org.name,
    code: org.code,
    agentCount: org.agentCount,
    claimCount: org.claimCount,
    createdAt: org.createdAt.toISOString(),
  }));
}

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .max(255, "Organization name must be 255 characters or less"),
  code: z
    .string()
    .min(1, "Organization code is required")
    .max(20, "Organization code must be 20 characters or less")
    .regex(
      /^[A-Z0-9]+$/,
      "Code must contain only uppercase letters and numbers"
    ),
});

export async function createOrganization(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") {
    return { success: false, error: "Unauthorized — admin access required" };
  }

  const raw = {
    name: formData.get("name") as string,
    code: (formData.get("code") as string)?.toUpperCase(),
  };

  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, code } = parsed.data;

  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.code, code))
    .limit(1);

  if (existing.length > 0) {
    return {
      success: false,
      error: "An organization with this code already exists",
      fieldErrors: { code: ["This code is already in use"] },
    };
  }

  const [organization] = await db
    .insert(organizations)
    .values({ name, code })
    .returning();

  return { success: true, organization };
}
