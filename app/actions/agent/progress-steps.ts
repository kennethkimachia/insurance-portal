"use server";

import { actionError } from "@/lib/action-errors";

import { db } from "@/db";
import {
  claimProgressSteps,
  claims,
  claimEvents,
  claimNotifications,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { closedClaimStatuses } from "@/lib/claim-workflow";
import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
) {
  try {
    const session = await requireSession();
    const claim = await requireClaimAccess(session, claimId, "manage");
    requireOpen(claim.status);
    const title = label.trim();
    const content = description?.trim() ?? "";
    if (title.length < 3 || title.length > 100 || content.length > 2000)
      throw new Error(
        "Use a task title of 3–100 characters and a description of at most 2,000 characters",
      );
    const step = await db.transaction(async (tx) => {
      await lockClaimForMutation(tx, session, claimId, claim.version);
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
          actorId: session.id,
          type: "task_created",
          content: `Supporting task added: ${title}.`,
          metadata: { stepId: created.id },
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
  return changeStep(stepId, "complete");
}
export async function uncompleteProgressStep(stepId: string) {
  return changeStep(stepId, "reopen");
}
export async function removeProgressStep(stepId: string) {
  return changeStep(stepId, "remove");
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
