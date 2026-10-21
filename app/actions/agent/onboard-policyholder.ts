"use server";

import { actionError } from "@/lib/action-errors";

import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { requireOrganizationAccess } from "@/lib/organization-access";
import { createPortalInvitation } from "@/lib/invitations";
import { normalizedPhone } from "@/lib/invitation-policy";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      !value ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value),
    "Use a valid date.",
  );
const onboardSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(255),
    phone: z
      .string()
      .transform((value) => normalizedPhone(value))
      .refine(
        (value) => value !== null,
        "Use a valid contact number including the country code.",
      ),
    policyType: z.enum(["motor", "burglary"]),
    organizationId: z.string().uuid(),
    source: z.enum(["manual", "demo"]),
    insurerReference: z.string().trim().max(100),
    coverageStart: optionalDate,
    coverageEnd: optionalDate,
    insuredAsset: z.string().trim().min(3).max(500),
    coverageSummary: z.string().trim().min(5).max(2000),
  })
  .superRefine((data, ctx) => {
    if (
      data.coverageStart &&
      data.coverageEnd &&
      data.coverageEnd < data.coverageStart
    )
      ctx.addIssue({
        code: "custom",
        path: ["coverageEnd"],
        message: "Coverage end must be on or after its start.",
      });
    if (
      data.source === "manual" &&
      (!data.insurerReference || !data.coverageStart || !data.coverageEnd)
    )
      ctx.addIssue({
        code: "custom",
        path: ["insurerReference"],
        message:
          "A manual policy requires its insurer reference and coverage dates.",
      });
  });

export async function onboardPolicyholder(formData: FormData) {
  try {
    const actor = await requireSession();
    requirePermission(actor.role, permissions.POLICYHOLDER_INVITE);
    const parsed = onboardSchema.safeParse(
      Object.fromEntries(
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
      ),
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
