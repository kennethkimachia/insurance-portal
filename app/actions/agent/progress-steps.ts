"use server";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  claimProgressSteps,
  claims,
  claimEvents,
  claimNotifications,
  claimAttachments,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { closedClaimStatuses } from "@/lib/claim-workflow";
import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WORK_RESULTS, workResultSchema, workResultReplayMatches, formatCaseworkTime } from "@/lib/claim-casework";
import { RESPONSIBLE_PARTIES } from "@/lib/claim-communication";

const failure = (error: unknown) => ({
  success: false as const,
  error: actionError(error, "Unable to update this task"),
});
function requireOpen(status: string) {
  if (
    status === "draft" ||
    closedClaimStatuses.some((closed) => closed === status)
  )
    throw new Error("Tasks can only be changed on open submitted claims");
}
const serialize = (step: typeof claimProgressSteps.$inferSelect) => ({
  ...step,
  completedAt: step.completedAt?.toISOString() ?? null,
  createdAt: step.createdAt.toISOString(),
});

export async function getProgressSteps(claimId: string) {
  await requireClaimAccess(await requireSession(), claimId);
  const steps = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, claimId))
    .orderBy(asc(claimProgressSteps.stepOrder));
  return steps.map(serialize);
}

export async function addProgressStep(
  claimId: string,
  label: string,
  description?: string,
  plan?: { responsibleParty: string; followUpAt: string },
  requestId?: string,
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    const title = label.trim();
    const content = description?.trim() ?? "";
    const eventId = requestId ? z.string().uuid().parse(requestId) : crypto.randomUUID();
    const schedule = plan ? z.object({ responsibleParty: z.enum(["agent", "policyholder", "insurer", "surveyor", "repairer", "other"]), followUpAt: z.string().datetime({ offset: true }) }).parse(plan) : null;
    if (schedule && content.length < 10) throw new Error("Explain what has happened in at least 10 characters.");
    if (title.length < 3 || title.length > 100 || content.length > 2000)
      throw new Error(
        "Use a task title of 3–100 characters and a description of at most 2,000 characters",
      );
    const step = await db.transaction(async (tx) => {
      const fresh = await lockClaimForMutation(tx, session, claimId, claim.version);
      const [previous] = await tx.select().from(claimEvents).where(eq(claimEvents.id, eventId)).limit(1);
      if (previous) {
        if (previous.claimId !== claimId || previous.actorId !== session.id || previous.type !== "task_created" || previous.metadata.label !== title || previous.metadata.description !== content || previous.metadata.responsibleParty !== schedule?.responsibleParty || previous.metadata.followUpAt !== schedule?.followUpAt) throw new Error("This activity reference was already used for another entry.");
        const [recorded] = await tx.select().from(claimProgressSteps).where(and(eq(claimProgressSteps.id, String(previous.metadata.stepId)), eq(claimProgressSteps.claimId, claimId))).limit(1);
        if (!recorded) throw new Error("This activity is already recorded in the claim history.");
        return recorded;
      }
      requireOpen(fresh.status);
      if (schedule && Date.parse(schedule.followUpAt) <= Date.now()) throw new Error("Set a future time for the next policyholder update.");
      const [changed] = await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1` })
        .where(and(eq(claims.id, claimId), eq(claims.version, claim.version)))
        .returning({ id: claims.id });
      if (!changed)
        throw new Error("This claim changed. Refresh and try again.");
      const [max] = await tx
        .select({
          next: sql<number>`COALESCE(MAX(${claimProgressSteps.stepOrder}), 0) + 1`,
        })
        .from(claimProgressSteps)
        .where(eq(claimProgressSteps.claimId, claimId));
      const [created] = await tx
        .insert(claimProgressSteps)
        .values({
          claimId,
          stepOrder: max.next,
          label: title,
          description: content || null,
          isSystem: false,
        })
        .returning();
      await tx
        .insert(claimEvents)
        .values({
          claimId,
          id: eventId,
          actorId: session.id,
          type: "task_created",
          content: `${content || title}${schedule ? `\nNext action: ${title}. Responsible: ${RESPONSIBLE_PARTIES[schedule.responsibleParty]}. Expected update: ${formatCaseworkTime(schedule.followUpAt)} EAT.` : `\nWork to track: ${title}.`}`,
          metadata: { stepId: created.id, label: title, description: content, schedule, ...(schedule ?? {}) },
        });
      await tx
        .insert(claimNotifications)
        .values({
          claimId,
          userId: claim.policyholderId,
          type: "task_update",
          message: `A supporting task was added to ${claim.claimNumber}: ${title}.`,
        });
      return created;
    });
    revalidatePath(`/claims/${claimId}`);
    return { success: true as const, step: serialize(step) };
  } catch (error) {
    return failure(error);
  }
}

async function changeStep(
  stepId: string,
  action: "complete" | "reopen" | "remove",
) {
  try {
    const session = await requireSession();
    const [step] = await db
      .select()
      .from(claimProgressSteps)
      .where(eq(claimProgressSteps.id, stepId))
      .limit(1);
    if (!step) throw new Error("Task not found");
    const claim = await requireClaimAccess(session, step.claimId, "manage");
    requireOpen(claim.status);
    if (step.isSystem)
      throw new Error("Primary milestones are updated by the claim workflow");
    if (action === "complete" && step.isCompleted)
      throw new Error("This task is already complete");
    if (action === "reopen" && !step.isCompleted)
      throw new Error("This task is already open");
    if (action === "remove" && step.isCompleted)
      throw new Error("Completed tasks remain in claim history");
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claim.id, claim.version);
      const [changed] = await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1` })
        .where(and(eq(claims.id, claim.id), eq(claims.version, claim.version)))
        .returning({ id: claims.id });
      if (!changed)
        throw new Error("This claim changed. Refresh and try again.");
      if (action === "remove")
        await tx
          .delete(claimProgressSteps)
          .where(eq(claimProgressSteps.id, stepId));
      else
        await tx
          .update(claimProgressSteps)
          .set({
            isCompleted: action === "complete",
            completedAt: action === "complete" ? new Date() : null,
            completedBy: action === "complete" ? session.id : null,
          })
          .where(eq(claimProgressSteps.id, stepId));
      await tx
        .insert(claimEvents)
        .values({
          claimId: claim.id,
          actorId: session.id,
          type: `task_${action}`,
          content: `Supporting task ${action === "complete" ? "completed" : action === "reopen" ? "reopened" : "removed"}: ${step.label}.`,
          metadata: { stepId, previousCompleted: step.isCompleted },
        });
      await tx
        .insert(claimNotifications)
        .values({
          claimId: claim.id,
          userId: claim.policyholderId,
          type: "task_update",
          message: `Supporting task ${action === "complete" ? "completed" : action === "reopen" ? "reopened" : "removed"} on ${claim.claimNumber}: ${step.label}.`,
        });
    });
    revalidatePath(`/claims/${claim.id}`);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function completeProgressStep(stepId: string) {
  z.string().uuid().parse(stepId);
  return { success: false as const, error: "Record a work result and explanation before closing this action." };
}
export async function uncompleteProgressStep(stepId: string) {
  return changeStep(stepId, "reopen");
}
export async function removeProgressStep(stepId: string) {
  return changeStep(stepId, "remove");
}

/** One result closes the work, records the public explanation and schedules its follow-up. */
export async function recordProgressResult(stepId: string, input: unknown, requestId: string) {
  try {
    z.string().uuid().parse(stepId);
    const parsed = workResultSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
    const data = parsed.data;
    const eventId = z.string().uuid().parse(requestId);
    const session = await requireSession();
    const [step] = await db.select().from(claimProgressSteps).where(eq(claimProgressSteps.id, stepId)).limit(1);
    if (!step) throw new Error("Work item not found");
    const claim = await requireClaimAccess(session, step.claimId, "manage");
    await db.transaction(async (tx) => {
      const fresh = await lockClaimForMutation(tx, session, claim.id);
      const [existing] = await tx.select().from(claimEvents).where(eq(claimEvents.id, eventId)).limit(1);
      if (existing) {
        if (!workResultReplayMatches(existing, claim.id, session.id, stepId, data)) throw new Error("This result reference was already used for another entry.");
        return;
      }
      requireOpen(fresh.status);
      if (data.followUpAt && Date.parse(data.followUpAt) <= Date.now()) throw new Error("The follow-up time must be in the future.");
      if (fresh.status === "approved" && (data.assessedAmount || ["recommend_approval", "recommend_rejection"].includes(data.result))) throw new Error("A manager must reopen review before changing the assessment or recommendation on an approved claim.");
      const [current] = await tx.select().from(claimProgressSteps).where(eq(claimProgressSteps.id, stepId)).for("update").limit(1);
      if (!current || current.isSystem || current.isCompleted) throw new Error("This work is already closed or cannot receive a result. Refresh the claim.");
      if (data.assessmentAttachmentId) {
        const [source] = await tx.select().from(claimAttachments).where(and(eq(claimAttachments.id, data.assessmentAttachmentId), eq(claimAttachments.claimId, claim.id))).limit(1);
        if (!source || source.uploadState !== "ready" || source.scanState === "rejected") throw new Error("Select an available assessment document from this claim.");
      }
      let followUpStepId: string | null = null;
      if (data.result === "follow_up") {
        const [max] = await tx.select({ next: sql<number>`coalesce(max(${claimProgressSteps.stepOrder}),0) + 1` }).from(claimProgressSteps).where(eq(claimProgressSteps.claimId, claim.id));
        const [next] = await tx.insert(claimProgressSteps).values({ claimId: claim.id, stepOrder: max.next, label: data.followUpTitle, description: `Follow-up to: ${current.label}. ${data.summary}`, isSystem: false }).returning();
        followUpStepId = next.id;
      }
      await tx.update(claimProgressSteps).set({ isCompleted: true, completedAt: new Date(), completedBy: session.id }).where(eq(claimProgressSteps.id, stepId));
      const message = `${current.label}: ${WORK_RESULTS[data.result]}.\n${data.summary}${data.assessedAmount ? `\nAssessed cost: KES ${data.assessedAmount}. Source: ${data.assessmentBasis}` : ""}${followUpStepId ? `\nNext: ${data.followUpTitle}. Responsible: ${RESPONSIBLE_PARTIES[data.responsibleParty]}. Expected follow-up: ${formatCaseworkTime(data.followUpAt)} EAT.` : ""}${["recommend_approval", "recommend_rejection"].includes(data.result) ? "\nA claims manager must review this recommendation and record the claim decision." : ""}`;
      await tx.insert(claimEvents).values({ id: eventId, claimId: claim.id, actorId: session.id, type: "task_result", visibility: "public", content: message, metadata: { ...data, stepId, followUpStepId } });
      await tx.update(claims).set({ version: sql`${claims.version} + 1`, ...(data.assessedAmount ? { estimatedLossAmount: data.assessedAmount } : {}) }).where(eq(claims.id, claim.id));
      await tx.insert(claimNotifications).values({ claimId: claim.id, userId: claim.policyholderId, type: "task_update", message: `${claim.claimNumber}: ${current.label} — ${WORK_RESULTS[data.result]}.` });
    });
    revalidatePath(`/claims/${claim.id}`);
    revalidatePath("/claims");
    return { success: true as const };
  } catch (error) { return failure(error); }
}

export async function reorderProgressSteps(claimId: string, stepIds: string[]) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    requireOpen(claim.status);
    await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claimId, claim.version);
      const [changed] = await tx
        .update(claims)
        .set({ version: sql`${claims.version} + 1` })
        .where(and(eq(claims.id, claimId), eq(claims.version, claim.version)))
        .returning({ id: claims.id });
      if (!changed)
        throw new Error("This claim changed. Refresh and try again.");
      const steps = await tx
        .select()
        .from(claimProgressSteps)
        .where(eq(claimProgressSteps.claimId, claimId))
        .orderBy(asc(claimProgressSteps.stepOrder));
      const custom = steps.filter((step) => !step.isSystem);
      if (
        stepIds.length !== custom.length ||
        new Set(stepIds).size !== stepIds.length ||
        stepIds.some((id) => !custom.some((step) => step.id === id))
      )
        throw new Error(
          "Provide each supporting task exactly once; primary milestones cannot be reordered",
        );
      const lastSystemOrder = Math.max(
        0,
        ...steps.filter((step) => step.isSystem).map((step) => step.stepOrder),
      );
      for (const [index, id] of stepIds.entries())
        await tx
          .update(claimProgressSteps)
          .set({ stepOrder: lastSystemOrder + index + 1 })
          .where(eq(claimProgressSteps.id, id));
      await tx
        .insert(claimEvents)
        .values({
          claimId,
          actorId: session.id,
          type: "tasks_reordered",
          visibility: "internal",
          content: "Supporting tasks reordered.",
          metadata: { stepIds },
        });
    });
    revalidatePath(`/claims/${claimId}`);
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
