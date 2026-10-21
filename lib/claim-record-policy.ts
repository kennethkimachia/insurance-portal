export const CLOSED_CLAIM_STATUSES = new Set([
  "settled",
  "rejected",
  "withdrawn",
]);

export function makeClaimReference(orgCode: string, claimId: string): string {
  return `CLM-${orgCode
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}-${claimId.replace(/-/g, "").toUpperCase()}`;
}

export function claimNextAction(status: string, openRequests: number): string {
  if (status === "draft") return "Resume your report and submit when ready.";
  if (CLOSED_CLAIM_STATUSES.has(status))
    return "Review the recorded outcome and contact your agent if you need help.";
  if (openRequests)
    return `Respond to ${openRequests} information request${openRequests === 1 ? "" : "s"}.`;
  if (status === "awaiting_information")
    return "Open your claim to review the information requested by your agent.";
  if (status === "pending")
    return "Your report is received. You can add documents while waiting for an agent.";
  if (status === "approved")
    return "An approval is recorded. A settlement has not yet been recorded.";
  return "Your agent is reviewing the claim. You can add evidence or an amendment.";
}
