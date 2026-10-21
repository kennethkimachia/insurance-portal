import { z } from "zod";
import {
  EVIDENCE_CATEGORIES,
  MAX_FILE_BYTES,
  evidenceCategoryApplies,
  validateEvidenceTotals,
} from "../claim-evidence";

export const CLAIM_FORM_VERSION = "fnol-v1";
export const answerSchema = z.enum(["yes", "no", "unknown"]);
const text = (max = 500) => z.string().trim().max(max).default("");
const answer = () => answerSchema.default("unknown");
const commonShape = {
  description: text(5000),
  contactPhone: text(30),
  incidentTiming: z
    .enum(["exact", "approximate", "unknown"])
    .default("unknown"),
  incidentDate: text(10),
  incidentTime: text(5),
  incidentRangeStart: text(10),
  incidentRangeEnd: text(10),
  discoveryDate: text(10),
  discoveryTime: text(5),
  policeReportStatus: z
    .enum(["not_yet", "reported", "unknown"])
    .default("not_yet"),
  policeStation: text(100),
  obNumber: text(50),
  declarationAccepted: z.boolean().default(false),
  privacyAccepted: z.boolean().default(false),
  pendingEvidence: z
    .array(
      z.object({
        clientUploadId: z.string().uuid(),
        name: z.string().trim().min(1).max(255),
        size: z.number().int().positive().max(MAX_FILE_BYTES),
        category: z.enum(EVIDENCE_CATEGORIES),
        lossItemId: z.string().uuid().optional(),
      }),
    )
    .max(20)
    .default([]),
};

export const thirdPartySchema = z.object({
  name: text(100),
  registrationNumber: text(50),
  contactPhone: text(30),
  injuryDetails: text(1000),
});

export const lossItemDraftSchema = z.object({
  itemKey: z.string().uuid(),
  description: text(500),
  quantity: z.number().int().min(1).max(100000).default(1),
  identifyingDetails: text(500),
  purchaseDate: text(10),
  purchaseDateApproximate: z.boolean().default(false),
  originalCost: text(20),
  replacementValue: text(20),
  ownershipEvidence: z
    .enum(["receipt", "valuation", "alternative", "not_available", "unknown"])
    .default("unknown"),
});

export const motorClaimDraftSchema = z.object({
  ...commonShape,
  incidentType: z
    .enum(["accident", "theft", "other_damage"])
    .default("accident"),
  registrationNumber: text(20),
  make: text(50),
  model: text(50),
  currentMileage: text(20),
  driverFullName: text(100),
  licenseNumber: text(50),
  yearsOfExperience: text(10),
  relationshipToPolicyholder: text(30),
  incidentLocation: text(500),
  weatherConditions: text(30),
  estimatedSpeed: text(10),
  reportingOfficer: text(100),
  damageSummary: text(5000),
  isVehicleDrivable: answer(),
  vehicleCurrentLocation: text(500),
  thirdPartyRegistration: text(50),
  thirdPartyInjuries: text(1000),
  injuries: answer(),
  thirdParties: z.array(thirdPartySchema).max(20).default([]),
  witnesses: text(1000),
  repairEstimateStatus: z
    .enum(["available", "not_yet", "unknown"])
    .default("not_yet"),
});

export const burglaryClaimDraftSchema = z.object({
  ...commonShape,
  premisesLocation: text(500),
  premisesUse: z
    .enum(["residential", "business", "unknown"])
    .default("unknown"),
  buildingType: text(30),
  wasAnyoneHome: answer(),
  entryMethod: text(1000),
  evidenceOfViolence: answer(),
  alarmFitted: answer(),
  alarmActiveAtTime: z.enum(["yes", "no", "unknown", "n_a"]).default("unknown"),
  securityFirmName: text(100),
  exteriorLockTypes: text(1000),
  dateReported: text(10),
  premisesDamage: text(1000),
  lossItems: z.array(lossItemDraftSchema).max(100).default([]),
});

export type MotorClaimFormData = z.infer<typeof motorClaimDraftSchema>;
export type BurglaryClaimFormData = z.infer<typeof burglaryClaimDraftSchema>;
export type LossItem = z.infer<typeof lossItemDraftSchema>;
export type ClaimFormData = MotorClaimFormData | BurglaryClaimFormData;
export type CommonClaimFormData = Pick<
  MotorClaimFormData,
  keyof typeof commonShape
>;

export function blankMotorClaim(): MotorClaimFormData {
  return motorClaimDraftSchema.parse({});
}
export function blankBurglaryClaim(): BurglaryClaimFormData {
  return burglaryClaimDraftSchema.parse({});
}
export function blankLossItem(): LossItem {
  return lossItemDraftSchema.parse({ itemKey: crypto.randomUUID() });
}

/** Calendar date in the portal's reporting timezone, including around UTC midnight. */
export function reportingToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Exact integer cents; no floating-point summation and no malformed-input fallback. */
export function moneyToMinorUnits(value: string): number | null {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

type ValidationContext = {
  addIssue: (issue: {
    code: "custom";
    path: (string | number)[];
    message: string;
  }) => void;
};
function issue(
  ctx: ValidationContext,
  path: (string | number)[],
  message: string,
) {
  ctx.addIssue({ code: "custom", path, message });
}

function checkDate(
  value: string,
  key: string | (string | number)[],
  ctx: ValidationContext,
) {
  if (value && (!isCalendarDate(value) || value > reportingToday())) {
    issue(
      ctx,
      Array.isArray(key) ? key : [key],
      "Enter a real date that is today or earlier",
    );
  }
}

function validateCommon(data: CommonClaimFormData, ctx: ValidationContext) {
  if (data.description.length < 10)
    issue(
      ctx,
      ["description"],
      "Describe what happened in at least 10 characters",
    );
  if (
    !/^\+?[\d\s()-]{7,30}$/.test(data.contactPhone) ||
    data.contactPhone.replace(/\D/g, "").length < 7 ||
    data.contactPhone.replace(/\D/g, "").length > 15
  ) {
    issue(ctx, ["contactPhone"], "Enter a contact number with 7 to 15 digits");
  }
  for (const key of [
    "incidentDate",
    "incidentRangeStart",
    "incidentRangeEnd",
    "discoveryDate",
  ] as const)
    checkDate(data[key], key, ctx);
  for (const key of ["incidentTime", "discoveryTime"] as const) {
    if (data[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data[key]))
      issue(ctx, [key], "Enter a valid time, or leave it unknown");
  }
  if (data.incidentTiming === "exact" && !data.incidentDate)
    issue(ctx, ["incidentDate"], "Enter the incident date");
  if (data.incidentTiming === "approximate") {
    if (!data.incidentRangeStart)
      issue(
        ctx,
        ["incidentRangeStart"],
        "Enter the earliest possible incident date",
      );
    if (!data.incidentRangeEnd)
      issue(
        ctx,
        ["incidentRangeEnd"],
        "Enter the latest possible incident date",
      );
    if (
      data.incidentRangeStart &&
      data.incidentRangeEnd &&
      data.incidentRangeStart > data.incidentRangeEnd
    )
      issue(
        ctx,
        ["incidentRangeEnd"],
        "The end of the range must follow its start",
      );
  }
  if (data.incidentTiming === "unknown" && !data.discoveryDate)
    issue(ctx, ["discoveryDate"], "Enter when you discovered the incident");
  if (
    data.incidentTiming !== "exact" &&
    (data.incidentDate || data.incidentTime)
  )
    issue(
      ctx,
      ["incidentTiming"],
      "Remove the exact incident date and time, or select a known incident date",
    );
  if (
    data.incidentTiming !== "approximate" &&
    (data.incidentRangeStart || data.incidentRangeEnd)
  )
    issue(
      ctx,
      ["incidentTiming"],
      "Remove the date range, or select an approximate date range",
    );
  if (data.discoveryTime && !data.discoveryDate)
    issue(
      ctx,
      ["discoveryDate"],
      "Enter the discovery date for this time, or leave the time unknown",
    );
  const lastIncidentDate =
    data.incidentTiming === "exact"
      ? data.incidentDate
      : data.incidentTiming === "approximate"
        ? data.incidentRangeEnd
        : "";
  if (
    data.discoveryDate &&
    lastIncidentDate &&
    data.discoveryDate < lastIncidentDate
  )
    issue(ctx, ["discoveryDate"], "Discovery cannot be before the incident");
  if (
    data.discoveryDate === data.incidentDate &&
    data.incidentTiming === "exact" &&
    data.discoveryTime &&
    data.incidentTime &&
    data.discoveryTime < data.incidentTime
  )
    issue(
      ctx,
      ["discoveryTime"],
      "Discovery cannot be before the incident time",
    );
  if (
    data.policeReportStatus === "not_yet" &&
    (data.policeStation || data.obNumber)
  )
    issue(
      ctx,
      ["policeReportStatus"],
      "Select reported if police-report details have been entered",
    );
  if (!data.declarationAccepted)
    issue(
      ctx,
      ["declarationAccepted"],
      "Confirm that the report is accurate to the best of your knowledge",
    );
  if (!data.privacyAccepted)
    issue(
      ctx,
      ["privacyAccepted"],
      "Acknowledge how the portal uses the report and documents",
    );
  const uploadIds = new Set<string>();
  for (const file of data.pendingEvidence) {
    if (uploadIds.has(file.clientUploadId))
      issue(
        ctx,
        ["pendingEvidence"],
        "Each selected file must have a distinct upload reference",
      );
    uploadIds.add(file.clientUploadId);
  }
  const totalsError = validateEvidenceTotals(data.pendingEvidence);
  if (totalsError) issue(ctx, ["pendingEvidence"], totalsError);
}

function checkNumber(
  value: string,
  key: string,
  maximum: number,
  ctx: ValidationContext,
) {
  if (value && (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > maximum))
    issue(
      ctx,
      [key],
      `Enter a nonnegative number up to ${maximum}, or leave it unknown`,
    );
}

export const motorClaimSchema = motorClaimDraftSchema.superRefine(
  (data, ctx) => {
    validateCommon(data, ctx);
    if (!data.registrationNumber)
      issue(
        ctx,
        ["registrationNumber"],
        "Enter the insured vehicle registration",
      );
    if (data.incidentLocation.length < 3)
      issue(
        ctx,
        ["incidentLocation"],
        "Enter where the incident occurred or was discovered",
      );
    checkNumber(data.currentMileage, "currentMileage", 10000000, ctx);
    checkNumber(data.yearsOfExperience, "yearsOfExperience", 100, ctx);
    checkNumber(data.estimatedSpeed, "estimatedSpeed", 500, ctx);
    if (data.policeReportStatus === "not_yet" && data.reportingOfficer)
      issue(
        ctx,
        ["policeReportStatus"],
        "Select reported if reporting-officer details have been entered",
      );
    for (const file of data.pendingEvidence) {
      if (!evidenceCategoryApplies("motor", file.category) || file.lossItemId)
        issue(
          ctx,
          ["pendingEvidence"],
          "Choose evidence categories for this Motor report",
        );
    }
    data.thirdParties.forEach((person, index) => {
      if (
        person.contactPhone &&
        !/^\+?[\d\s()-]{7,30}$/.test(person.contactPhone)
      )
        issue(
          ctx,
          ["thirdParties", index, "contactPhone"],
          "Enter a valid number, or leave it unknown",
        );
    });
  },
);

export const burglaryClaimSchema = burglaryClaimDraftSchema.superRefine(
  (data, ctx) => {
    validateCommon(data, ctx);
    if (data.premisesLocation.length < 3)
      issue(
        ctx,
        ["premisesLocation"],
        "Enter the premises address or location",
      );
    checkDate(data.dateReported, "dateReported", ctx);
    const earliestIncident =
      data.incidentTiming === "exact"
        ? data.incidentDate
        : data.incidentTiming === "approximate"
          ? data.incidentRangeStart
          : data.discoveryDate;
    if (
      data.dateReported &&
      earliestIncident &&
      data.dateReported < earliestIncident
    )
      issue(
        ctx,
        ["dateReported"],
        "The police report cannot precede the incident",
      );
    if (data.policeReportStatus === "not_yet" && data.dateReported)
      issue(
        ctx,
        ["dateReported"],
        "Remove the reporting date or select reported",
      );
    if (
      data.alarmFitted === "no" &&
      data.alarmActiveAtTime !== "n_a" &&
      data.alarmActiveAtTime !== "unknown"
    )
      issue(
        ctx,
        ["alarmActiveAtTime"],
        "An alarm cannot be active if no alarm is fitted",
      );
    if (data.alarmFitted === "yes" && data.alarmActiveAtTime === "n_a")
      issue(
        ctx,
        ["alarmActiveAtTime"],
        "Select yes, no, or unknown for the fitted alarm",
      );
    const itemKeys = new Set<string>();
    data.lossItems.forEach((item, index) => {
      if (itemKeys.has(item.itemKey))
        issue(
          ctx,
          ["lossItems", index, "description"],
          "Each inventory item must have a distinct reference",
        );
      itemKeys.add(item.itemKey);
      if (!item.description)
        issue(
          ctx,
          ["lossItems", index, "description"],
          "Describe this item, or remove the empty row",
        );
      checkDate(item.purchaseDate, ["lossItems", index, "purchaseDate"], ctx);
      if (
        item.purchaseDate &&
        earliestIncident &&
        item.purchaseDate > earliestIncident
      )
        issue(
          ctx,
          ["lossItems", index, "purchaseDate"],
          "Purchase must be before the incident",
        );
      for (const key of ["originalCost", "replacementValue"] as const) {
        if (item[key] && moneyToMinorUnits(item[key]) === null)
          issue(
            ctx,
            ["lossItems", index, key],
            "Enter a positive KES amount with at most two decimal places, or leave it unknown",
          );
      }
    });
    for (const file of data.pendingEvidence) {
      if (!evidenceCategoryApplies("burglary", file.category, data.premisesUse))
        issue(
          ctx,
          ["pendingEvidence"],
          "Choose evidence categories for these premises",
        );
      if (file.lossItemId && !itemKeys.has(file.lossItemId))
        issue(
          ctx,
          ["pendingEvidence"],
          "The evidence refers to a removed inventory item. Choose its current item or remove the reminder",
        );
    }
  },
);

export const motorClaimSubmissionSchema = motorClaimSchema.safeExtend({
  policyId: z.string().uuid(),
  claimId: z.string().uuid(),
});
export const burglaryClaimSubmissionSchema = burglaryClaimSchema.safeExtend({
  policyId: z.string().uuid(),
  claimId: z.string().uuid(),
});
