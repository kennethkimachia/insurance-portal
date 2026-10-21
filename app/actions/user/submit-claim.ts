"use server";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  claims,
  policies,
  organizations,
  motorClaimDetails,
  burglaryClaimDetails,
  burglaryLossItems,
  claimEvents,
  claimProgressSteps,
  agentOrganizations,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { requireOrganizationAccess } from "@/lib/organization-access";
import {
  motorClaimSubmissionSchema,
  burglaryClaimSubmissionSchema,
  motorClaimDraftSchema,
  burglaryClaimDraftSchema,
  CLAIM_FORM_VERSION,
} from "@/lib/schemas/claim-forms";
import type {
  MotorClaimFormData,
  BurglaryClaimFormData,
} from "@/lib/schemas/claim-forms";
import { makeClaimReference } from "@/lib/claim-record-policy";
import { revalidatePath } from "next/cache";
import { requireCurrentActor } from "@/lib/transaction-identity";

const draftEnvelope = z.object({
  policyId: z.string().uuid(),
  claimId: z.string().uuid(),
  policyType: z.enum(["motor", "burglary"]),
  formData: z.unknown(),
});

async function writeReport(
  input: unknown,
  kind: "motor" | "burglary",
  submit: boolean,
) {
  try {
    const session = await requireSession();
    const envelope = submit
      ? (kind === "motor"
          ? motorClaimSubmissionSchema
          : burglaryClaimSubmissionSchema
        ).safeParse(input)
      : draftEnvelope.safeParse(input);
    if (!envelope.success)
      return {
        success: false as const,
        error: "Please check the highlighted fields",
        fieldErrors: envelope.error.flatten().fieldErrors,
      };
    const supplied = envelope.data;
    const payload = submit
      ? supplied
      : (supplied as z.infer<typeof draftEnvelope>).formData;
    const parsed = (
      kind === "motor" ? motorClaimDraftSchema : burglaryClaimDraftSchema
    ).safeParse(payload);
    if (!parsed.success)
      return {
        success: false as const,
        error: "Draft contains invalid values",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, supplied.policyId))
      .limit(1);
    if (!policy || policy.policyType !== kind)
      throw new Error("Policy not found or policy type does not match");
    if (session.role === "user") {
      if (
        policy.userId !== session.id ||
        policy.organizationId !== session.organizationId
      )
        throw new Error("This policy does not belong to you");
    } else {
      await requireOrganizationAccess(session, policy.organizationId);
    }
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, policy.organizationId))
      .limit(1);
    if (!org) throw new Error("Organization not found");
    const claimId = supplied.claimId;
    const report = parsed.data;
    const result = await db.transaction(async (tx) => {
      const actor = await requireCurrentActor(tx, session);
      const [currentPolicy] = await tx
        .select()
        .from(policies)
        .where(eq(policies.id, policy.id))
        .for("share")
        .limit(1);
      if (
        !currentPolicy ||
        currentPolicy.policyType !== kind ||
        currentPolicy.organizationId !== policy.organizationId ||
        currentPolicy.userId !== policy.userId
      )
        throw new Error("Policy access changed. Refresh before saving.");
      if (
        actor.role === "user" &&
        (actor.id !== currentPolicy.userId ||
          actor.organizationId !== currentPolicy.organizationId)
      )
        throw new Error("Policy not found or access denied");
      if (actor.role !== "user" && actor.role !== "admin") {
        const [membership] = await tx
          .select()
          .from(agentOrganizations)
          .where(
            and(
              eq(agentOrganizations.agentId, actor.id),
              eq(
                agentOrganizations.organizationId,
                currentPolicy.organizationId,
              ),
            ),
          )
          .for("share")
          .limit(1);
        if (!membership)
          throw new Error(
            "Your organization access changed. Refresh before saving.",
          );
      }
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${claimId}))`);
      let [claim] = await tx
        .select()
        .from(claims)
        .where(eq(claims.id, claimId))
        .for("update")
        .limit(1);
      if (
        claim &&
        (claim.policyId !== policy.id ||
          (claim.createdBy !== session.id &&
            policy.userId !== session.id &&
            session.role !== "admin"))
      )
        throw new Error("Draft not found or access denied");
      if (claim && claim.status !== "draft") {
        if (!submit)
          throw new Error(
            "This claim is already submitted. Add an amendment from its detail page.",
          );
        return { claim, alreadySubmitted: true };
      }
      const now = new Date();
      const values = {
        description: report.description,
        formData: report as unknown as Record<string, unknown>,
        incidentDate:
          report.incidentDate ||
          report.incidentRangeStart ||
          report.discoveryDate ||
          null,
        contactPhone: report.contactPhone || null,
        updatedAt: now,
      };
      if (!claim) {
        [claim] = await tx
          .insert(claims)
          .values({
            id: claimId,
            claimNumber: makeClaimReference(org.code, claimId),
            policyId: policy.id,
            organizationId: policy.organizationId,
            createdBy: session.id,
            status: "draft",
            ...values,
          })
          .returning();
      } else {
        [claim] = await tx
          .update(claims)
          .set({ ...values, version: sql`${claims.version} + 1` })
          .where(and(eq(claims.id, claimId), eq(claims.status, "draft")))
          .returning();
      }
      if (!submit) return { claim, alreadySubmitted: false };
      [claim] = await tx
        .update(claims)
        .set({
          status: "pending",
          submittedAt: now,
          submittedBy: session.id,
          originalSubmission: report as unknown as Record<string, unknown>,
          policySnapshot: {
            ...currentPolicy,
            createdAt: currentPolicy.createdAt.toISOString(),
          },
          formVersion: CLAIM_FORM_VERSION,
          version: sql`${claims.version} + 1`,
        })
        .where(eq(claims.id, claimId))
        .returning();
      if (kind === "motor") {
        const d = report as MotorClaimFormData;
        await tx
          .insert(motorClaimDetails)
          .values({
            claimId,
            registrationNumber: d.registrationNumber,
            make: d.make,
            model: d.model,
            currentMileage: d.currentMileage,
            driverFullName: d.driverFullName,
            licenseNumber: d.licenseNumber,
            yearsOfExperience: d.yearsOfExperience,
            relationshipToPolicyholder: d.relationshipToPolicyholder,
            incidentDate: d.incidentDate,
            incidentTime: d.incidentTime,
            incidentLocation: d.incidentLocation,
            weatherConditions: d.weatherConditions,
            estimatedSpeed: d.estimatedSpeed,
            policeStation: d.policeStation,
            obNumber: d.obNumber,
            reportingOfficer: d.reportingOfficer,
            damageSummary: d.damageSummary,
            isVehicleDrivable: d.isVehicleDrivable,
            vehicleCurrentLocation: d.vehicleCurrentLocation,
            thirdPartyRegistration: d.thirdPartyRegistration || null,
            thirdPartyInjuries: d.thirdPartyInjuries || null,
          });
      } else {
        const d = report as BurglaryClaimFormData;
        const [detail] = await tx
          .insert(burglaryClaimDetails)
          .values({
            claimId,
            premisesLocation: d.premisesLocation,
            buildingType: d.buildingType,
            wasAnyoneHome: d.wasAnyoneHome,
            entryMethod: d.entryMethod,
            evidenceOfViolence: d.evidenceOfViolence,
            alarmFitted: d.alarmFitted,
            alarmActiveAtTime: d.alarmActiveAtTime,
            securityFirmName: d.securityFirmName || null,
            exteriorLockTypes: d.exteriorLockTypes,
            policeStation: d.policeStation,
            dateReported: d.dateReported,
            obNumber: d.obNumber,
          })
          .returning();
        if (d.lossItems.length)
          await tx
            .insert(burglaryLossItems)
            .values(
              d.lossItems.map((item) => ({
                id: item.itemKey,
                burglaryDetailId: detail.id,
                description: item.description,
                purchaseDate: item.purchaseDate,
                originalCost: item.originalCost,
                replacementValue: item.replacementValue,
              })),
            );
      }
      await tx.insert(claimProgressSteps).values([
        {
          claimId,
          stepOrder: 1,
          label: "Report received",
          description:
            "Your incident report is saved. Coverage and evidence still need review.",
          isSystem: true,
          isCompleted: true,
          completedAt: now,
          completedBy: session.id,
        },
        {
          claimId,
          stepOrder: 2,
          label: "Agent assigned",
          description:
            "An agent will review your report and explain the next steps.",
          isSystem: true,
        },
        {
          claimId,
          stepOrder: 3,
          label: "Outcome recorded",
          description:
            "The portal records a manual or simulated outcome; it does not dispatch payments.",
          isSystem: true,
        },
      ]);
      await tx
        .insert(claimEvents)
        .values({
          claimId,
          actorId: session.id,
          type: "submitted",
          content:
            "Incident report received. Supporting documents can be added later.",
          metadata: {
            formVersion: CLAIM_FORM_VERSION,
            policyVersion: currentPolicy.version,
            reportedOnBehalf: currentPolicy.userId !== session.id,
          },
        });
      return { claim, alreadySubmitted: false };
    });
    revalidatePath("/dashboard/user");
    revalidatePath("/claims");
    return {
      success: true as const,
      claimId: result.claim.id,
      claimNumber: result.claim.claimNumber,
      organizationId: result.claim.organizationId,
      savedAt: result.claim.updatedAt.toISOString(),
      submittedAt: result.claim.submittedAt?.toISOString(),
      alreadySubmitted: result.alreadySubmitted,
    };
  } catch (error) {
    return {
      success: false as const,
      error: actionError(
        error,
        "Could not save the report. Retry with the same draft.",
      ),
    };
  }
}

export async function saveClaimDraft(input: z.infer<typeof draftEnvelope>) {
  const parsed = draftEnvelope.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: "Invalid draft request" };
  return writeReport(parsed.data, parsed.data.policyType, false);
}
export async function submitMotorClaim(
  input: z.input<typeof motorClaimSubmissionSchema>,
) {
  return writeReport(input, "motor", true);
}
export async function submitBurglaryClaim(
  input: z.input<typeof burglaryClaimSubmissionSchema>,
) {
  return writeReport(input, "burglary", true);
}
