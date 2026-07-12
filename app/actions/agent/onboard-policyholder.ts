"use server";

import { db } from "@/db";
import { user, policies, organizations, agentOrganizations } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const onboardSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  policyType: z.enum(["motor", "burglary"]),
  organizationId: z.string().uuid("Organization ID is required"),
});

/**
 * Generate a policy number.
 * Format: MOT-{ORG_CODE}-{5-digit} or BRG-{ORG_CODE}-{5-digit}
 */
function generatePolicyNumber(policyType: "motor" | "burglary", orgCode: string): string {
  const prefix = policyType === "motor" ? "MOT" : "BRG";
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${orgCode}-${num}`;
}

export async function onboardPolicyholder(formData: FormData) {
  const session = await requireSession();
  requirePermission(session.role, permissions.POLICY_CREATE);

  const raw = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    policyType: formData.get("policyType") as string,
    organizationId: formData.get("organizationId") as string,
  };

  const parsed = onboardSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { fullName, email, phone, policyType, organizationId } = parsed.data;

  // Verify the agent belongs to this organization
  if (session.role !== "admin") {
    const agentOrg = await db
      .select({ id: agentOrganizations.id })
      .from(agentOrganizations)
      .where(
        and(
          eq(agentOrganizations.agentId, session.id),
          eq(agentOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (agentOrg.length === 0) {
      return { success: false, error: "You are not assigned to this organization" };
    }
  }

  // Get organization code for policy number
  const [org] = await db
    .select({ code: organizations.code })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  // Find or create user by email
  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create a new user with role "user"
    const [newUser] = await db
      .insert(user)
      .values({
        name: fullName,
        email,
        role: "user",
        organizationId,
      })
      .returning({ id: user.id });
    userId = newUser.id;
  }

  // Check if this user already has a policy of this type
  const existingPolicy = await db
    .select({ id: policies.id })
    .from(policies)
    .where(and(eq(policies.userId, userId), eq(policies.policyType, policyType)))
    .limit(1);

  if (existingPolicy.length > 0) {
    return {
      success: false,
      error: `This user already has a ${policyType} policy`,
    };
  }

  // Generate a unique policy number
  let policyNumber = generatePolicyNumber(policyType, org.code);

  // Ensure uniqueness (rare collision)
  const existing = await db
    .select({ id: policies.id })
    .from(policies)
    .where(eq(policies.policyNumber, policyNumber))
    .limit(1);

  if (existing.length > 0) {
    policyNumber = generatePolicyNumber(policyType, org.code);
  }

  // Insert the policy
  const [newPolicy] = await db
    .insert(policies)
    .values({
      policyNumber,
      policyType,
      userId,
      organizationId,
    })
    .returning();

  return {
    success: true,
    policyNumber: newPolicy.policyNumber,
    policyholderName: fullName,
  };
}
