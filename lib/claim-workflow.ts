import type { Role } from "./permissions";

export const claimStatuses = [
  "draft",
  "pending",
  "assigned",
  "awaiting_information",
  "surveyor_dispatched",
  "under_review",
  "assessment_complete",
  "approved",
  "settled",
  "rejected",
  "withdrawn",
] as const;
export type ClaimStatus = (typeof claimStatuses)[number];
export const statusLabels: Record<ClaimStatus, string> = {
  draft: "Draft",
  pending: "Report received",
  assigned: "Agent assigned",
  awaiting_information: "Information requested",
  surveyor_dispatched: "Survey arranged",
  under_review: "Under review",
  assessment_complete: "Assessment complete",
  approved: "Approved",
  settled: "Settlement recorded",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const closedClaimStatuses: ClaimStatus[] = [
  "settled",
  "rejected",
  "withdrawn",
];
export const allowedStatusTransitions: Record<ClaimStatus, ClaimStatus[]> = {
  draft: [],
  pending: ["assigned", "withdrawn"],
  assigned: [
    "awaiting_information",
    "surveyor_dispatched",
    "under_review",
    "withdrawn",
  ],
  awaiting_information: ["assigned", "under_review", "withdrawn"],
  surveyor_dispatched: ["awaiting_information", "under_review", "withdrawn"],
  under_review: [
    "awaiting_information",
    "surveyor_dispatched",
    "assessment_complete",
    "withdrawn",
  ],
  assessment_complete: ["under_review", "approved", "rejected", "withdrawn"],
  approved: ["under_review", "settled", "withdrawn"],
  settled: [],
  rejected: ["under_review"],
  withdrawn: ["under_review"],
};
export function isClaimStatus(value: string): value is ClaimStatus {
  return claimStatuses.some((status) => status === value);
}
export function isManager(role: Role) {
  return role === "head_agent" || role === "admin";
}
export function requiresOutcomeReason(current: ClaimStatus, next: ClaimStatus) {
  return (
    ["approved", "rejected", "withdrawn", "settled"].includes(next) ||
    (["rejected", "withdrawn", "approved", "assessment_complete"].includes(
      current,
    ) &&
      next === "under_review")
  );
}
export function availableTransitions(status: ClaimStatus, role: Role) {
  if (role === "user") return [];
  return allowedStatusTransitions[status].filter(
    (next) =>
      // Assignment and information requests use their own audited operations.
      !(status === "pending" && next === "assigned") && next !== "awaiting_information" &&
      !(status === "awaiting_information" && next !== "withdrawn") &&
      (isManager(role) || !["approved", "rejected", "settled", "withdrawn"].includes(next)),
  );
}
export function validateStatusTransition(
  current: string,
  next: string,
  role: Role,
  reason?: string,
): string | null {
  if (!isClaimStatus(current) || !isClaimStatus(next))
    return "Invalid claim status";
  if (!availableTransitions(current, role).includes(next))
    return "This status change is not permitted for your role or the current stage";
  if (
    requiresOutcomeReason(current, next) &&
    (!reason || reason.trim().length < 10)
  )
    return "Provide a clear reason of at least 10 characters";
  if ((reason?.trim().length ?? 0) > 4000)
    return "The reason must be at most 4,000 characters";
  return null;
}

export interface ClaimReadiness {
  assessmentSummary: string | null;
  openEvidenceRequests: number;
  unreviewedDocuments: number;
}
export function validateClaimReadiness(
  next: ClaimStatus,
  readiness: ClaimReadiness,
): string | null {
  if (
    ["assessment_complete", "approved", "rejected", "settled"].includes(next) &&
    (!readiness.assessmentSummary ||
      readiness.assessmentSummary.trim().length < 20)
  )
    return "Record an assessment summary before completing an assessment or recording an outcome";
  if (["assessment_complete", "approved", "settled"].includes(next)) {
    if (readiness.openEvidenceRequests > 0)
      return "Resolve all outstanding information requests first";
    if (readiness.unreviewedDocuments > 0)
      return "Inspect and accept or explicitly waive every supporting document first";
  }
  return null;
}
