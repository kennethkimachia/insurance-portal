import { z } from "zod";
import { closedClaimStatuses } from "./claim-workflow";
import { isCalendarDate } from "./schemas/claim-forms";
export const UPDATE_KINDS = {
    general: "Progress update", evidence: "Evidence review", survey: "Survey / inspection",
    repair: "Repair update", insurer: "Insurer follow-up", delay: "Delay / blocker", settlement: "Settlement update",
} as const;
export const RESPONSIBLE_PARTIES = {
    agent: "Your claims agent", policyholder: "Policyholder", insurer: "Insurance company",
    surveyor: "Surveyor / assessor", repairer: "Repairer / supplier", other: "Another party", none: "No action required",
} as const;
const optionalInstant = z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && isCalendarDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v)), "Use a valid date and time with a timezone.");
export const claimUpdateSchema = z.object({
    kind: z.enum(Object.keys(UPDATE_KINDS) as [
        keyof typeof UPDATE_KINDS,
        ...(keyof typeof UPDATE_KINDS)[]
    ]),
    visibility: z.enum(["public", "internal"]),
    title: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(4000),
    nextAction: z.string().trim().min(3).max(1000),
    responsibleParty: z.enum(Object.keys(RESPONSIBLE_PARTIES) as [
        keyof typeof RESPONSIBLE_PARTIES,
        ...(keyof typeof RESPONSIBLE_PARTIES)[]
    ]),
    waitingReason: z.string().trim().max(1000),
    nextUpdateAt: optionalInstant,
    appointmentAt: optionalInstant,
    appointmentLocation: z.string().trim().max(500),
    contactDetails: z.string().trim().max(500),
}).superRefine((v, ctx) => {
    if (v.visibility === "public" && !v.nextUpdateAt)
        ctx.addIssue({ code: "custom", path: ["nextUpdateAt"], message: "Tell the policyholder when the next update is expected." });
    if (v.kind === "delay" && v.waitingReason.length < 10)
        ctx.addIssue({ code: "custom", path: ["waitingReason"], message: "Explain the delay and what is being done about it." });
    if (v.appointmentLocation && !v.appointmentAt)
        ctx.addIssue({ code: "custom", path: ["appointmentAt"], message: "Add the appointment time, or leave the location blank until arranged." });
});
export type ClaimUpdate = z.infer<typeof claimUpdateSchema>;
export function claimUpdateReplayMatches(record: {
    claimId: string;
    actorId: string | null;
    type: string;
    visibility: string;
    metadata: Record<string, unknown>;
}, claimId: string, actorId: string, data: ClaimUpdate) {
    const previous = claimUpdateSchema.safeParse(record.metadata);
    return record.claimId === claimId && record.actorId === actorId && record.type === "progress_update" && record.visibility === data.visibility && previous.success && JSON.stringify(previous.data) === JSON.stringify(data);
}
export function validateUpdateTiming(update: ClaimUpdate, now = new Date()) {
    if (update.nextUpdateAt && Date.parse(update.nextUpdateAt) <= now.getTime())
        return "The next update must be in the future.";
    if (update.appointmentAt && Date.parse(update.appointmentAt) <= now.getTime())
        return "An arranged appointment must be in the future; describe past visits in the update text.";
    return null;
}
export function latestPublicClaimUpdate(events: {
    type: string;
    visibility: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}[]) {
    const sorted = [...events].filter((e) => e.type === "progress_update" && e.visibility === "public").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const event of sorted) {
        const parsed = claimUpdateSchema.safeParse(event.metadata);
        if (parsed.success && parsed.data.visibility === "public")
            return { ...parsed.data, publishedAt: event.createdAt };
    }
    return null;
}
export function updateIsOverdue(nextUpdateAt: string | null | undefined, status: string, now = new Date()) {
    return !closedClaimStatuses.some((s) => s === status) && !!nextUpdateAt && Number.isFinite(Date.parse(nextUpdateAt)) && Date.parse(nextUpdateAt) < now.getTime();
}
export function claimJourney(status: string, assigned: boolean) {
    const outcome = ["approved", "settled", "rejected", "withdrawn"].includes(status);
    const noSettlement = ["rejected", "withdrawn"].includes(status);
    return [
        { label: "Report received", detail: "Your incident report is preserved in the portal.", state: status === "draft" ? "pending" : "complete" },
        { label: "Claims agent assigned", detail: "The head agent allocates a handler for your claim.", state: assigned ? "complete" : "pending" },
        { label: "Evidence and assessment", detail: status === "awaiting_information" ? "Information is requested. See the request instructions and alternatives." : "Your agent reviews available evidence and records an assessment.", state: ["assessment_complete", "approved", "settled"].includes(status) ? "complete" : noSettlement ? "ended" : "pending" },
        { label: "Decision recorded", detail: "A manager records the outcome and its explanation.", state: outcome ? "complete" : "pending" },
        { label: "Settlement recorded", detail: noSettlement ? "No settlement is implied by this outcome." : "A recorded settlement includes an amount and an external or simulation reference.", state: status === "settled" ? "complete" : noSettlement ? "not_applicable" : "pending" },
    ];
}
