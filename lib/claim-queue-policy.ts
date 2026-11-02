import { closedClaimStatuses } from "./claim-workflow";
import { updateIsOverdue } from "./claim-communication";
export interface QueueAttention {
    status: string;
    createdAt: string;
    respondedRequestCount?: number;
    unreviewedDocumentCount?: number;
    overdueRequestCount?: number;
    withdrawalRequestedAt?: string | null;
    nextUpdateAt?: string | null;
}
export function claimAttention(claim: QueueAttention, now = new Date()) {
    if (closedClaimStatuses.some((s) => s === claim.status))
        return { rank: 0, label: "Closed", category: "closed" };
    if (claim.withdrawalRequestedAt)
        return { rank: 5, label: "Manager: review withdrawal", category: "review" };
    if (updateIsOverdue(claim.nextUpdateAt, claim.status, now))
        return { rank: 4, label: "Policyholder update overdue", category: "followup" };
    if (claim.respondedRequestCount)
        return { rank: 3, label: `${claim.respondedRequestCount} policyholder replies to review`, category: "review" };
    if (claim.unreviewedDocumentCount)
        return { rank: 2, label: `${claim.unreviewedDocumentCount} documents to inspect`, category: "review" };
    if (claim.overdueRequestCount)
        return { rank: 1, label: "Follow up on overdue information", category: "followup" };
    if (claim.status === "awaiting_information")
        return { rank: 0, label: "Waiting for information", category: "waiting" };
    return { rank: 1, label: "Ready for agent review", category: "review" };
}
export function compareQueueClaims(a: QueueAttention, b: QueueAttention, now = new Date()) {
    return claimAttention(b, now).rank - claimAttention(a, now).rank || a.createdAt.localeCompare(b.createdAt);
}
