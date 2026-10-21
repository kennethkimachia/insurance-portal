import type { Role } from "./permissions";
import type { ClaimWorkspaceData } from "@/components/claims/claim-workspace";
import { blankMotorClaim, blankBurglaryClaim } from "./schemas/claim-forms";

export const DEMO_IDS = {
  organization: "f18d9d3c-4cda-41d0-9a88-abd245824500",
  user: "f18d9d3c-4cda-41d0-9a88-abd245824501",
  agent: "f18d9d3c-4cda-41d0-9a88-abd245824502",
  motorPolicy: "f18d9d3c-4cda-41d0-9a88-abd245824503",
  burglaryPolicy: "f18d9d3c-4cda-41d0-9a88-abd245824504",
  claim: "f18d9d3c-4cda-41d0-9a88-abd245824505",
};
const time = "2026-10-03T08:00:00.000Z";
export const DEMO_POLICY_PROFILE = {
  policyNumber: "DEMO-MOT-001",
  organizationName: "Demonstration Insurance",
  source: "demo",
  status: "active",
  coverageStart: "2026-01-01",
  coverageEnd: "2026-12-31",
  insuredAsset: "Synthetic vehicle · DEMO 001",
  coverageSummary:
    "Demonstration profile only. Coverage requires insurer confirmation.",
  insurerReference: null,
};

export function demoReport(kind: "motor" | "burglary") {
  const base = {
    description:
      "A synthetic incident is being reported to demonstrate the portal's claim journey.",
    contactPhone: "+254000000000",
    incidentTiming: "unknown" as const,
    discoveryDate: "2026-10-02",
    policeReportStatus: "not_yet" as const,
    declarationAccepted: true,
    privacyAccepted: true,
  };
  return kind === "motor"
    ? {
        ...blankMotorClaim(),
        ...base,
        registrationNumber: "DEMO 001",
        incidentLocation: "Demonstration parking area, Nairobi",
        incidentType: "other_damage" as const,
      }
    : {
        ...blankBurglaryClaim(),
        ...base,
        premisesLocation: "Demonstration premises, Nairobi",
        premisesUse: "business" as const,
        lossItems: [
          {
            itemKey: "f18d9d3c-4cda-41d0-9a88-abd245824510",
            description: "Synthetic desk chair",
            quantity: 2,
            identifyingDetails: "Demonstration asset CHAIR-001",
            purchaseDate: "2025-01-01",
            purchaseDateApproximate: false,
            originalCost: "3000.50",
            replacementValue: "3500.00",
            ownershipEvidence: "alternative" as const,
          },
        ],
      };
}

export function demoWorkspace(
  role: Role,
  kind: "motor" | "burglary" = "motor",
): ClaimWorkspaceData {
  const form = demoReport(kind);
  const staff = role !== "user";
  return {
    role,
    claim: {
      id: DEMO_IDS.claim,
      claimNumber: "DEMO-CLAIM-001",
      policyId:
        kind === "motor" ? DEMO_IDS.motorPolicy : DEMO_IDS.burglaryPolicy,
      policyNumber: kind === "motor" ? "DEMO-MOT-001" : "DEMO-BRG-001",
      policyType: kind,
      status: "awaiting_information",
      description: form.description,
      formData: form,
      originalSubmission: form,
      policySnapshot: {
        ...DEMO_POLICY_PROFILE,
        policyNumber: kind === "motor" ? "DEMO-MOT-001" : "DEMO-BRG-001",
        insuredAsset:
          kind === "burglary"
            ? "Demonstration premises, Nairobi"
            : DEMO_POLICY_PROFILE.insuredAsset,
      },
      formVersion: "fnol-v1",
      version: 3,
      incidentDate: form.discoveryDate,
      contactPhone: form.contactPhone,
      createdBy: DEMO_IDS.user,
      submittedBy: DEMO_IDS.user,
      submittedAt: time,
      createdAt: time,
      updatedAt: time,
      outcomeReason: null,
      outcomeSource: null,
      assessmentSummary: staff
        ? "Synthetic review is awaiting a document or a recorded explanation of its absence."
        : null,
      estimatedLossAmount: staff ? "7000.00" : null,
      assessedBy: staff ? DEMO_IDS.agent : null,
      assessedAt: staff ? time : null,
      assignedAgentId: DEMO_IDS.agent,
      assignedBy: DEMO_IDS.agent,
      organizationId: DEMO_IDS.organization,
      organizationName: "Demonstration Insurance",
      policyholderId: DEMO_IDS.user,
      policyholderName: "Amina Demo",
      policyholderEmail: "policyholder@example.test",
      agentName: "Sam Demo",
      agentEmail: "agent@example.test",
      withdrawalRequestedAt: null,
      withdrawalReason: null,
      carrierReference: null,
      carrierHandoffState: "not_sent",
      settlementAmount: null,
      settlementReference: null,
      settlementRecordedAt: null,
    },
    events: [
      {
        id: "demo-event-1",
        claimId: DEMO_IDS.claim,
        actorId: DEMO_IDS.user,
        type: "submitted",
        visibility: "public",
        content:
          "Incident report received. Supporting documents can be added later.",
        metadata: {},
        createdAt: time,
      },
      {
        id: "demo-event-2",
        claimId: DEMO_IDS.claim,
        actorId: DEMO_IDS.agent,
        type: "assigned",
        visibility: "public",
        content: "Sam Demo was assigned to review your report.",
        metadata: {},
        createdAt: time,
      },
    ],
    notes: staff
      ? [
          {
            id: "demo-note-1",
            content:
              "Synthetic internal note: confirm which evidence is appropriate before recording an outcome.",
            visibility: "internal",
            createdAt: time,
            authorName: "Sam Demo",
          },
        ]
      : [],
    requests: [
      {
        id: "f18d9d3c-4cda-41d0-9a88-abd245824520",
        claimId: DEMO_IDS.claim,
        requestedBy: DEMO_IDS.agent,
        title: "Police-report availability",
        category: "police_abstract",
        message:
          "If a police acknowledgment is available, upload it. Otherwise reply with what is available and your agent will explain the next step.",
        dueAt: null,
        status: "open",
        response: null,
        responseBy: null,
        responseAt: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: time,
        updatedAt: time,
      },
    ],
    documents: [
      {
        id: "f18d9d3c-4cda-41d0-9a88-abd245824521",
        name: "synthetic-scene-photo.png",
        type: "image/png",
        size: 128000,
        category: kind === "motor" ? "scene_photos" : "entry_photos",
        lossItemId: null,
        clientUploadId: "f18d9d3c-4cda-41d0-9a88-abd245824522",
        uploadState: "ready",
        uploadError: null,
        scanState: "pending",
        reviewStatus: "pending",
        reviewNote: null,
        uploadedAt: time,
      },
    ],
    progress: [
      {
        id: "demo-progress-1",
        claimId: DEMO_IDS.claim,
        stepOrder: 1,
        label: "Report received",
        isSystem: true,
        description: "Your incident report is saved.",
        isCompleted: true,
        completedAt: time,
        completedBy: DEMO_IDS.user,
        createdAt: time,
      },
      {
        id: "demo-progress-2",
        claimId: DEMO_IDS.claim,
        stepOrder: 2,
        label: "Agent assigned",
        isSystem: true,
        description: "Your assigned agent will review the report.",
        isCompleted: true,
        completedAt: time,
        completedBy: DEMO_IDS.agent,
        createdAt: time,
      },
      {
        id: "demo-progress-3",
        claimId: DEMO_IDS.claim,
        stepOrder: 3,
        label: "Outcome recorded",
        isSystem: true,
        description: "No outcome has been recorded yet.",
        isCompleted: false,
        completedAt: null,
        completedBy: null,
        createdAt: time,
      },
    ],
    agent: {
      id: DEMO_IDS.agent,
      name: "Sam Demo",
      email: "agent@example.test",
      phone: null,
    },
    similar: [],
  };
}
