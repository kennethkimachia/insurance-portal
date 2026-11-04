import { z } from "zod";
import { isCalendarDate } from "./schemas/claim-forms";

export const WORK_RESULTS = {
  completed: "Work completed",
  follow_up: "Follow-up required",
  recommend_approval: "Approval recommended",
  recommend_rejection: "Rejection recommended",
  cancelled: "Work closed without completion",
} as const;

export const workResultSchema = z.object({
  result: z.enum(["completed", "follow_up", "recommend_approval", "recommend_rejection", "cancelled"]),
  summary: z.string().trim().min(10).max(4000),
  followUpTitle: z.string().trim().max(100).default(""),
  responsibleParty: z.enum(["agent", "policyholder", "insurer", "surveyor", "repairer", "other", "none"]).default("agent"),
  followUpAt: z.string().refine((value) => !value || isCalendarDate(value.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), "Enter a valid follow-up time.").default(""),
  assessedAmount: z.string().trim().regex(/^(?:|\d{1,12}(?:\.\d{1,2})?)$/, "Enter a valid KES amount.").refine((value) => !value || Number(value) > 0, "The assessed cost must be positive.").default(""),
  assessmentBasis: z.string().trim().max(1000).default(""),
  assessmentAttachmentId: z.union([z.literal(""), z.string().uuid()]).default(""),
}).superRefine((value, context) => {
  if (value.result === "follow_up" && (value.followUpTitle.length < 3 || !value.followUpAt || value.responsibleParty === "none"))
    context.addIssue({ code: "custom", message: "Set the follow-up work, responsible party and expected follow-up time." });
  if (value.result !== "follow_up" && (value.followUpTitle || value.followUpAt))
    context.addIssue({ code: "custom", message: "Choose Follow-up required to schedule more work." });
  if (value.assessedAmount && (value.assessmentBasis.length < 10 || value.result === "cancelled"))
    context.addIssue({ code: "custom", message: "Describe the assessment or quotation that established this cost (at least 10 characters). Cancelled work cannot establish a cost." });
  if (!value.assessedAmount && (value.assessmentBasis || value.assessmentAttachmentId))
    context.addIssue({ code: "custom", message: "Enter the assessed cost or remove its source details." });
});
export type WorkResult = z.infer<typeof workResultSchema>;
export const formatCaseworkTime = (value: string) => new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
export type WorkEvent = { id?: string; type: string; createdAt: string; visibility: string; metadata: Record<string, unknown> };

export function latestWorkResult(stepId: string, events: WorkEvent[]) {
  const event = events.filter((item) => item.type === "task_result" && item.metadata.stepId === stepId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (b.id ?? "").localeCompare(a.id ?? ""))[0];
  if (!event) return null;
  const parsed = workResultSchema.safeParse(event.metadata);
  return parsed.success ? { ...parsed.data, createdAt: event.createdAt, followUpStepId: typeof event.metadata.followUpStepId === "string" ? event.metadata.followUpStepId : null } : null;
}

export function latestAssessedCost(events: WorkEvent[]) {
  for (const event of [...events].filter((entry) => entry.type === "task_result").sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const result = workResultSchema.safeParse(event.metadata);
    if (result.success && result.data.assessedAmount) return { ...result.data, createdAt: event.createdAt };
  }
  return null;
}

export function workResultReplayMatches(event: { claimId: string; actorId: string | null; type: string; metadata: Record<string, unknown> }, claimId: string, actorId: string, stepId: string, input: WorkResult) {
  const parsed = workResultSchema.safeParse(event.metadata);
  return event.type === "task_result" && event.claimId === claimId && event.actorId === actorId && event.metadata.stepId === stepId && parsed.success && JSON.stringify(parsed.data) === JSON.stringify(input);
}
