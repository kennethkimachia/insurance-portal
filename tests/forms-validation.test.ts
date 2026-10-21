import test from "node:test";
import assert from "node:assert/strict";
import {
  blankMotorClaim,
  blankBurglaryClaim,
  motorClaimSchema,
  burglaryClaimSchema,
  motorClaimDraftSchema,
  burglaryClaimDraftSchema,
  reportingToday,
  isCalendarDate,
  moneyToMinorUnits,
  motorClaimSubmissionSchema,
} from "../lib/schemas/claim-forms";
import { policyProfileSchema } from "../lib/schemas/policy-profile";

const id = "39f09d04-ae45-4696-a0db-0cd3b490cdca";
const firstNotice = {
  description:
    "An incident was discovered and is being reported with the information currently available.",
  contactPhone: "+254 700 123 456",
  incidentTiming: "unknown" as const,
  discoveryDate: "2025-01-15",
  declarationAccepted: true,
  privacyAccepted: true,
};
const motor = () => ({
  ...blankMotorClaim(),
  ...firstNotice,
  registrationNumber: "DEMO 001",
  incidentLocation: "Nairobi parking area",
});
const burglary = () => ({
  ...blankBurglaryClaim(),
  ...firstNotice,
  premisesLocation: "Nairobi demonstration premises",
});
const item = () => ({
  itemKey: id,
  description: "Office chair",
  quantity: 2,
  replacementValue: "100.25",
  purchaseDate: "2024-01-01",
  ownershipEvidence: "alternative" as const,
});

test("both policies accept immediate first notice without police, inventory or evidence", () => {
  assert.ok(motorClaimSchema.safeParse(motor()).success);
  assert.ok(burglaryClaimSchema.safeParse(burglary()).success);
  assert.ok(
    motorClaimSchema.safeParse({ ...motor(), incidentType: "theft" }).success,
  );
  assert.ok(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      alarmFitted: "no",
      alarmActiveAtTime: "n_a",
    }).success,
  );
});

test("incomplete bounded drafts save separately from final declarations and required answers", () => {
  assert.ok(motorClaimDraftSchema.safeParse({}).success);
  assert.ok(burglaryClaimDraftSchema.safeParse({}).success);
  assert.equal(motorClaimSchema.safeParse(blankMotorClaim()).success, false);
  assert.equal(
    burglaryClaimSchema.safeParse(blankBurglaryClaim()).success,
    false,
  );
  assert.equal(
    motorClaimDraftSchema.safeParse({ description: "x".repeat(5001) }).success,
    false,
  );
  for (const changes of [
    { description: "short" },
    { contactPhone: "12" },
    { contactPhone: "+1234567890123456" },
    { declarationAccepted: false },
    { privacyAccepted: false },
  ])
    assert.equal(
      motorClaimSchema.safeParse({ ...motor(), ...changes }).success,
      false,
    );
});

test("exact, approximate and discovery timing cannot contradict one another", () => {
  assert.ok(
    motorClaimSchema.safeParse({
      ...motor(),
      incidentTiming: "exact",
      incidentDate: "2025-01-15",
      incidentTime: "08:30",
      discoveryTime: "09:00",
    }).success,
  );
  assert.ok(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      incidentTiming: "approximate",
      incidentRangeStart: "2025-01-10",
      incidentRangeEnd: "2025-01-14",
    }).success,
  );
  for (const changes of [
    { incidentTiming: "exact", incidentDate: "" },
    { discoveryDate: "" },
    { incidentDate: "2025-01-15" },
    { incidentTime: "08:00" },
    { incidentRangeStart: "2025-01-01" },
    {
      incidentTiming: "approximate",
      incidentRangeStart: "2025-01-15",
      incidentRangeEnd: "2025-01-10",
    },
    { incidentTiming: "exact", incidentDate: "2025-01-16" },
    {
      incidentTiming: "exact",
      incidentDate: "2025-01-15",
      incidentTime: "11:00",
      discoveryTime: "10:00",
    },
    { discoveryTime: "24:00" },
    { discoveryDate: "2999-01-01" },
    { discoveryDate: "2025-02-30" },
  ])
    assert.equal(
      motorClaimSchema.safeParse({ ...motor(), ...changes }).success,
      false,
      JSON.stringify(changes),
    );
});

test("reporting dates use Nairobi midnight and reject impossible calendar dates", () => {
  assert.equal(reportingToday(new Date("2025-01-14T21:05:00Z")), "2025-01-15");
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(isCalendarDate("2025-02-29"), false);
  assert.equal(isCalendarDate("2025-04-31"), false);
  assert.equal(isCalendarDate("01/15/2025"), false);
});

test("police and alarm answers reject contradictory details while allowing unknowns", () => {
  assert.equal(
    motorClaimSchema.safeParse({ ...motor(), policeStation: "Station" })
      .success,
    false,
  );
  assert.equal(
    motorClaimSchema.safeParse({ ...motor(), reportingOfficer: "Officer" })
      .success,
    false,
  );
  assert.ok(
    motorClaimSchema.safeParse({ ...motor(), policeReportStatus: "reported" })
      .success,
  );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      alarmFitted: "no",
      alarmActiveAtTime: "yes",
    }).success,
    false,
  );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      alarmFitted: "yes",
      alarmActiveAtTime: "n_a",
    }).success,
    false,
  );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      policeReportStatus: "reported",
      dateReported: "2025-01-14",
    }).success,
    false,
  );
});

test("loss inventory accepts alternative ownership evidence and exact decimal amounts", () => {
  assert.ok(
    burglaryClaimSchema.safeParse({ ...burglary(), lossItems: [item()] })
      .success,
  );
  assert.ok(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      lossItems: [
        { ...item(), replacementValue: "", originalCost: "", purchaseDate: "" },
      ],
    }).success,
  );
  for (const changes of [
    { description: "" },
    { quantity: 0 },
    { quantity: 1.5 },
    { quantity: 100001 },
    { replacementValue: "-1" },
    { replacementValue: "0" },
    { replacementValue: "1.234" },
    { replacementValue: "1e3" },
    { originalCost: "NaN" },
    { purchaseDate: "2025-01-16" },
  ])
    assert.equal(
      burglaryClaimSchema.safeParse({
        ...burglary(),
        lossItems: [{ ...item(), ...changes }],
      }).success,
      false,
    );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      lossItems: [item(), item()],
    }).success,
    false,
  );
  assert.equal(moneyToMinorUnits("0.10"), 10);
  assert.equal(moneyToMinorUnits("100.25"), 10025);
  assert.equal(moneyToMinorUnits("9999999999.99"), 999999999999);
  assert.equal(moneyToMinorUnits("1.001"), null);
});

test("selected evidence is bounded, uses its policy categories and links existing inventory items", () => {
  const reminder = {
    clientUploadId: id,
    name: "receipt.pdf",
    size: 100,
    category: "proof_of_ownership" as const,
    lossItemId: id,
  };
  assert.ok(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      lossItems: [item()],
      pendingEvidence: [reminder],
    }).success,
  );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      pendingEvidence: [reminder],
    }).success,
    false,
  );
  assert.equal(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      pendingEvidence: [
        { ...reminder, lossItemId: undefined, category: "stock_records" },
      ],
    }).success,
    false,
  );
  assert.ok(
    burglaryClaimSchema.safeParse({
      ...burglary(),
      premisesUse: "business",
      pendingEvidence: [
        { ...reminder, lossItemId: undefined, category: "stock_records" },
      ],
    }).success,
  );
  assert.equal(
    motorClaimSchema.safeParse({ ...motor(), pendingEvidence: [reminder] })
      .success,
    false,
  );
  assert.equal(
    motorClaimSchema.safeParse({
      ...motor(),
      pendingEvidence: [
        { ...reminder, category: "other", lossItemId: undefined },
        { ...reminder, category: "other", lossItemId: undefined },
      ],
    }).success,
    false,
  );
  assert.equal(
    motorClaimSchema.safeParse({
      ...motor(),
      pendingEvidence: Array.from({ length: 4 }, (_, index) => ({
        ...reminder,
        category: "other",
        lossItemId: undefined,
        clientUploadId: `39f09d04-ae45-4696-a0db-0cd3b490cdc${index}`,
        size: 50 * 1024 * 1024,
      })),
    }).success,
    false,
  );
});

test("numeric motor answers and submission identifiers cannot silently fall back", () => {
  for (const changes of [
    { currentMileage: "-100" },
    { yearsOfExperience: "101" },
    { estimatedSpeed: "fast" },
    { estimatedSpeed: "501" },
  ])
    assert.equal(
      motorClaimSchema.safeParse({ ...motor(), ...changes }).success,
      false,
    );
  assert.ok(
    motorClaimSubmissionSchema.safeParse({
      ...motor(),
      policyId: id,
      claimId: id,
    }).success,
  );
  assert.equal(
    motorClaimSubmissionSchema.safeParse({ ...motor(), policyId: id }).success,
    false,
  );
  assert.equal(
    motorClaimSubmissionSchema.safeParse({
      ...motor(),
      policyId: "bogus",
      claimId: id,
    }).success,
    false,
  );
});

test("policy profiles distinguish demo metadata from manually recorded insurer references", () => {
  const profile = {
    status: "active",
    source: "demo",
    insurerReference: "",
    coverageStart: "",
    coverageEnd: "",
    insuredAsset: "Demo vehicle",
    coverageSummary: "Demonstration coverage; subject to insurer confirmation",
  };
  assert.ok(policyProfileSchema.safeParse(profile).success);
  assert.equal(
    policyProfileSchema.safeParse({ ...profile, source: "manual" }).success,
    false,
  );
  assert.ok(
    policyProfileSchema.safeParse({
      ...profile,
      source: "manual",
      insurerReference: "External reference",
      coverageStart: "2025-01-01",
      coverageEnd: "2025-12-31",
    }).success,
  );
  assert.equal(
    policyProfileSchema.safeParse({ ...profile, coverageStart: "2025-04-31" })
      .success,
    false,
  );
  assert.equal(
    policyProfileSchema.safeParse({
      ...profile,
      coverageStart: "2025-12-31",
      coverageEnd: "2025-01-01",
    }).success,
    false,
  );
});
