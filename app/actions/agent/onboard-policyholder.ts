"use server";

import { actionError } from "@/lib/action-errors";

import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { requireOrganizationAccess } from "@/lib/organization-access";
import { createPortalInvitation } from "@/lib/invitations";
import { policyholderOnboardingSchema } from "@/lib/schemas/policyholder-onboarding";
import { revalidatePath } from "next/cache";

export async function onboardPolicyholder(formData: FormData) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.POLICYHOLDER_INVITE);
    const parsed = policyholderOnboardingSchema.safeParse(
      { ...Object.fromEntries(
        [
          "fullName",
          "email",
          "phone",
          "policyType",
          "organizationId",
          "source",
          "insurerReference",
          "coverageStart",
          "coverageEnd",
          "insuredAsset",
          "coverageSummary",
        ].map((key) => [key, formData.get(key) ?? ""]),
      ), status: "active", policyConfirmed: formData.get("policyConfirmed") === "true" },
    );
    if (!parsed.success)
      return {
        success: false as const,
        error: "Check the policyholder and policy details.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    const {
      fullName,
      email,
      phone,
      policyType,
      organizationId,
      source,
      insurerReference,
      coverageStart,
      coverageEnd,
      insuredAsset,
      coverageSummary,
    } = parsed.data;
    await requireOrganizationAccess(actor, organizationId);
    const result = await createPortalInvitation({
      actor,
      email,
      role: "user",
      purpose: "policyholder",
      organizationId,
      enrollmentName: fullName,
      enrollmentPhone: phone!,
      enrollmentPolicyType: policyType,
      policyProfile: {
        source,
        insurerReference: insurerReference || null,
        coverageStart: coverageStart || null,
        coverageEnd: coverageEnd || null,
        insuredAsset,
        coverageSummary,
      },
    });
    revalidatePath("/dashboard", "layout");
    return { ...result, policyholderName: fullName };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(
        error,
        "Could not create the policyholder invitation.",
      ),
    };
  }
}
