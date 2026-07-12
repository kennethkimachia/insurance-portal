"use server";

import { db } from "@/db";
import {
  claims,
  policies,
  motorClaimDetails,
  burglaryClaimDetails,
  burglaryLossItems,
  claimAttachments,
  claimProgressSteps,
  claimNotifications,
  organizations,
  user,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { buildClaimFileKey, getUploadUrl } from "@/lib/storage";
import { requireOrganizationAccess } from "@/lib/organization-access";
import type { SessionUser } from "@/lib/session";

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

async function requireClaimAttachmentAccess(session: SessionUser, claimId: string) {
  const [claim] = await db
    .select({
      organizationId: claims.organizationId,
      policyholderId: policies.userId,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) throw new Error("Claim not found");
  if (session.role === "user" && claim.policyholderId !== session.id) {
    throw new Error("This claim does not belong to you");
  }
  if (session.role !== "user") {
    await requireOrganizationAccess(session, claim.organizationId);
  }
  return claim;
}


// ── Default progress steps (seeded on claim creation) ──────────────────

const DEFAULT_STEPS = [
  { label: "First Notice of Loss (FNOL)", description: "Incident reported and initial details captured." },
  { label: "Policy Verification", description: "Coverage, active dates, deductibles, and peril type confirmed." },
  { label: "Evidence & Documentation", description: "Photos, police reports, receipts, and third-party info gathered." },
  { label: "Submission to Carrier", description: "Formatted data submitted to the insurance company's system." },
  { label: "Triage & Assignment", description: "Carrier assigns a specialized claims adjuster." },
];

// ── Claim number generation ────────────────────────────────────────────

function generateClaimNumber(orgCode: string): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `CLM-${orgCode}-${num}`;
}

// ── Motor claim submission ─────────────────────────────────────────────

const motorClaimFormSchema = z.object({
  policyId: z.string().uuid(),
  description: z.string().min(1, "Please describe the incident"),
  registrationNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  currentMileage: z.string().min(1),
  driverFullName: z.string().min(1),
  licenseNumber: z.string().min(1),
  yearsOfExperience: z.string().min(1),
  relationshipToPolicyholder: z.string().min(1),
  incidentDate: z.string().min(1),
  incidentTime: z.string().min(1),
  incidentLocation: z.string().min(1),
  weatherConditions: z.string().min(1),
  estimatedSpeed: z.string().min(1),
  policeStation: z.string().min(1),
  obNumber: z.string().min(1),
  reportingOfficer: z.string().min(1),
  damageSummary: z.string().min(1),
  isVehicleDrivable: z.string().min(1),
  vehicleCurrentLocation: z.string().min(1),
  thirdPartyRegistration: z.string().optional(),
  thirdPartyInjuries: z.string().optional(),
});

export async function submitMotorClaim(data: z.infer<typeof motorClaimFormSchema>) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_CREATE);

  const parsed = motorClaimFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const formData = parsed.data;

  // Verify user owns this policy
  const [policy] = await db
    .select({
      id: policies.id,
      policyType: policies.policyType,
      userId: policies.userId,
      organizationId: policies.organizationId,
    })
    .from(policies)
    .where(eq(policies.id, formData.policyId))
    .limit(1);

  if (!policy) {
    return { success: false, error: "Policy not found" };
  }

  if (session.role === "user" && policy.userId !== session.id) {
    return { success: false, error: "This policy does not belong to you" };
  }

  if (policy.policyType !== "motor") {
    return { success: false, error: "This policy is not a motor policy" };
  }

  // Get org code for claim number
  const [org] = await db
    .select({ code: organizations.code })
    .from(organizations)
    .where(eq(organizations.id, policy.organizationId))
    .limit(1);

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  const claimNumber = generateClaimNumber(org.code);

  // Create the claim
  const [claim] = await db
    .insert(claims)
    .values({
      claimNumber,
      policyId: policy.id,
      status: "pending",
      description: formData.description || formData.damageSummary,
      organizationId: policy.organizationId,
    })
    .returning();

  // Create motor-specific details
  await db.insert(motorClaimDetails).values({
    claimId: claim.id,
    registrationNumber: formData.registrationNumber,
    make: formData.make,
    model: formData.model,
    currentMileage: formData.currentMileage,
    driverFullName: formData.driverFullName,
    licenseNumber: formData.licenseNumber,
    yearsOfExperience: formData.yearsOfExperience,
    relationshipToPolicyholder: formData.relationshipToPolicyholder,
    incidentDate: formData.incidentDate,
    incidentTime: formData.incidentTime,
    incidentLocation: formData.incidentLocation,
    weatherConditions: formData.weatherConditions,
    estimatedSpeed: formData.estimatedSpeed,
    policeStation: formData.policeStation,
    obNumber: formData.obNumber,
    reportingOfficer: formData.reportingOfficer,
    damageSummary: formData.damageSummary,
    isVehicleDrivable: formData.isVehicleDrivable,
    vehicleCurrentLocation: formData.vehicleCurrentLocation,
    thirdPartyRegistration: formData.thirdPartyRegistration || null,
    thirdPartyInjuries: formData.thirdPartyInjuries || null,
  });

  // Seed default progress steps
  await db.insert(claimProgressSteps).values(
    DEFAULT_STEPS.map((step, index) => ({
      claimId: claim.id,
      stepOrder: index + 1,
      label: step.label,
      description: step.description,
      isCompleted: index === 0, // Mark FNOL as completed (claim was just filed)
      completedAt: index === 0 ? new Date() : null,
      completedBy: index === 0 ? session.id : null,
    }))
  );

  return {
    success: true,
    claimNumber: claim.claimNumber,
    claimId: claim.id,
    organizationId: policy.organizationId,
  };
}

// ── Burglary claim submission ──────────────────────────────────────────

const burglaryClaimFormSchema = z.object({
  policyId: z.string().uuid(),
  description: z.string().min(1, "Please describe the incident"),
  premisesLocation: z.string().min(1),
  buildingType: z.string().min(1),
  wasAnyoneHome: z.string().min(1),
  entryMethod: z.string().min(1),
  evidenceOfViolence: z.string().min(1),
  alarmFitted: z.string().min(1),
  alarmActiveAtTime: z.string().min(1),
  securityFirmName: z.string().nullable().optional(),
  exteriorLockTypes: z.string().min(1),
  policeStation: z.string().min(1),
  dateReported: z.string().min(1),
  obNumber: z.string().min(1),
  lossItems: z.array(
    z.object({
      description: z.string().min(1),
      purchaseDate: z.string().min(1),
      originalCost: z.string().min(1),
      replacementValue: z.string().min(1),
    })
  ).min(1, "At least one loss item is required"),
});

export async function submitBurglaryClaim(data: z.infer<typeof burglaryClaimFormSchema>) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_CREATE);

  const parsed = burglaryClaimFormSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const formData = parsed.data;

  // Verify user owns this policy
  const [policy] = await db
    .select({
      id: policies.id,
      policyType: policies.policyType,
      userId: policies.userId,
      organizationId: policies.organizationId,
    })
    .from(policies)
    .where(eq(policies.id, formData.policyId))
    .limit(1);

  if (!policy) return { success: false, error: "Policy not found" };
  if (session.role === "user" && policy.userId !== session.id) {
    return { success: false, error: "This policy does not belong to you" };
  }
  if (policy.policyType !== "burglary") {
    return { success: false, error: "This policy is not a burglary policy" };
  }

  const [org] = await db
    .select({ code: organizations.code })
    .from(organizations)
    .where(eq(organizations.id, policy.organizationId))
    .limit(1);

  if (!org) return { success: false, error: "Organization not found" };

  const claimNumber = generateClaimNumber(org.code);

  const [claim] = await db
    .insert(claims)
    .values({
      claimNumber,
      policyId: policy.id,
      status: "pending",
      description: formData.description,
      organizationId: policy.organizationId,
    })
    .returning();

  // Create burglary-specific details
  const [detail] = await db
    .insert(burglaryClaimDetails)
    .values({
      claimId: claim.id,
      premisesLocation: formData.premisesLocation,
      buildingType: formData.buildingType,
      wasAnyoneHome: formData.wasAnyoneHome,
      entryMethod: formData.entryMethod,
      evidenceOfViolence: formData.evidenceOfViolence,
      alarmFitted: formData.alarmFitted,
      alarmActiveAtTime: formData.alarmActiveAtTime,
      securityFirmName: formData.securityFirmName || null,
      exteriorLockTypes: formData.exteriorLockTypes,
      policeStation: formData.policeStation,
      dateReported: formData.dateReported,
      obNumber: formData.obNumber,
    })
    .returning();

  // Insert loss items
  if (formData.lossItems.length > 0) {
    await db.insert(burglaryLossItems).values(
      formData.lossItems.map((item) => ({
        burglaryDetailId: detail.id,
        description: item.description,
        purchaseDate: item.purchaseDate,
        originalCost: item.originalCost,
        replacementValue: item.replacementValue,
      }))
    );
  }

  // Seed default progress steps
  await db.insert(claimProgressSteps).values(
    DEFAULT_STEPS.map((step, index) => ({
      claimId: claim.id,
      stepOrder: index + 1,
      label: step.label,
      description: step.description,
      isCompleted: index === 0,
      completedAt: index === 0 ? new Date() : null,
      completedBy: index === 0 ? session.id : null,
    }))
  );

  return {
    success: true,
    claimNumber: claim.claimNumber,
    claimId: claim.id,
    organizationId: policy.organizationId,
  };
}

// ── File upload URL generation ─────────────────────────────────────────

export async function getClaimUploadUrl(
  claimId: string,
  orgId: string,
  filename: string,
  contentType: string
) {
  const session = await requireSession();
  if (!ALLOWED_ATTACHMENT_TYPES.has(contentType)) {
    throw new Error("Unsupported attachment type");
  }
  const claim = await requireClaimAttachmentAccess(session, claimId);
  if (claim.organizationId !== orgId) {
    throw new Error("Organization does not match this claim");
  }
  if (!filename.trim() || filename.length > 255) {
    throw new Error("Invalid filename");
  }


  const key = buildClaimFileKey(orgId, claimId, filename);
  const url = await getUploadUrl(key, contentType);

  return { url, key };
}

export async function recordClaimAttachment(data: {
  claimId: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}) {
  const session = await requireSession();
  const claim = await requireClaimAttachmentAccess(session, data.claimId);
  if (!ALLOWED_ATTACHMENT_TYPES.has(data.contentType)) {
    throw new Error("Unsupported attachment type");
  }
  if (data.sizeBytes <= 0 || data.sizeBytes > 50 * 1024 * 1024) {
    throw new Error("Attachments must be no larger than 50 MB");
  }
  const expectedPrefix = `${claim.organizationId}/claims/${data.claimId}/`;
  if (!data.storageKey.startsWith(expectedPrefix)) {
    throw new Error("Invalid attachment storage path");
  }

  await db.insert(claimAttachments).values({
    claimId: data.claimId,
    storageKey: data.storageKey,
    originalFilename: data.originalFilename,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    uploadedBy: session.id,
  });

  return { success: true };
}
