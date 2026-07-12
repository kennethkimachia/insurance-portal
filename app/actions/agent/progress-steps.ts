"use server";

import { db } from "@/db";
import { claimProgressSteps, claims } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, asc, sql, max } from "drizzle-orm";

import { requireOrganizationAccess } from "@/lib/organization-access";
import type { SessionUser } from "@/lib/session";

async function requireClaimManagement(session: SessionUser, claimId: string) {
  const [claim] = await db
    .select({
      organizationId: claims.organizationId,
      assignedAgentId: claims.assignedAgentId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) throw new Error("Claim not found");
  await requireOrganizationAccess(session, claim.organizationId);

  if (session.role === "agent" && claim.assignedAgentId !== session.id) {
    throw new Error("This claim is not assigned to you");
  }
}

// ── Get progress steps ─────────────────────────────────────────────────

export async function getProgressSteps(claimId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_READ);
  await requireClaimManagement(session, claimId);

  const steps = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, claimId))
    .orderBy(asc(claimProgressSteps.stepOrder));

  return steps.map((s) => ({
    ...s,
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));
}

// ── Add a new progress step ────────────────────────────────────────────

export async function addProgressStep(
  claimId: string,
  label: string,
  description?: string
) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_CREATE);

  if (!label.trim()) {
    return { success: false, error: "Step label is required" };
  }

  await requireClaimManagement(session, claimId);
  // Get the max step order for this claim
  const [maxResult] = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${claimProgressSteps.stepOrder}), 0)` })
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, claimId));

  const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

  const [step] = await db
    .insert(claimProgressSteps)
    .values({
      claimId,
      stepOrder: nextOrder,
      label: label.trim(),
      description: description?.trim() || null,
    })
    .returning();

  return {
    success: true,
    step: {
      ...step,
      completedAt: step.completedAt?.toISOString() ?? null,
      createdAt: step.createdAt.toISOString(),
    },
  };
}

// ── Complete a progress step ───────────────────────────────────────────

export async function completeProgressStep(stepId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_UPDATE);

  const [step] = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.id, stepId))
    .limit(1);

  if (!step) return { success: false, error: "Step not found" };
  if (step.isCompleted) return { success: false, error: "Step is already completed" };
  await requireClaimManagement(session, step.claimId);

  await db
    .update(claimProgressSteps)
    .set({
      isCompleted: true,
      completedAt: new Date(),
      completedBy: session.id,
    })
    .where(eq(claimProgressSteps.id, stepId));

  return { success: true };
}

// ── Uncomplete a progress step ─────────────────────────────────────────

export async function uncompleteProgressStep(stepId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_UPDATE);

  const [step] = await db
    .select({ claimId: claimProgressSteps.claimId })
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.id, stepId))
    .limit(1);
  if (!step) return { success: false, error: "Step not found" };
  await requireClaimManagement(session, step.claimId);

  await db
    .update(claimProgressSteps)
    .set({
      isCompleted: false,
      completedAt: null,
      completedBy: null,
    })
    .where(eq(claimProgressSteps.id, stepId));

  return { success: true };
}

// ── Remove a progress step ─────────────────────────────────────────────

export async function removeProgressStep(stepId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_UPDATE);

  const [step] = await db
    .select()
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.id, stepId))
    .limit(1);

  if (!step) return { success: false, error: "Step not found" };
  if (step.isCompleted) return { success: false, error: "Cannot remove a completed step" };
  await requireClaimManagement(session, step.claimId);

  await db
    .delete(claimProgressSteps)
    .where(eq(claimProgressSteps.id, stepId));

  // Re-order remaining steps
  const remaining = await db
    .select({ id: claimProgressSteps.id })
    .from(claimProgressSteps)
    .where(eq(claimProgressSteps.claimId, step.claimId))
    .orderBy(asc(claimProgressSteps.stepOrder));

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(claimProgressSteps)
      .set({ stepOrder: i + 1 })
      .where(eq(claimProgressSteps.id, remaining[i].id));
  }

  return { success: true };
}

// ── Reorder progress steps ─────────────────────────────────────────────

export async function reorderProgressSteps(claimId: string, stepIds: string[]) {
  const session = await requireSession();
  requirePermission(session.role, permissions.PROGRESS_UPDATE);

  await requireClaimManagement(session, claimId);
  for (let i = 0; i < stepIds.length; i++) {
    await db
      .update(claimProgressSteps)
      .set({ stepOrder: i + 1 })
      .where(
        and(
          eq(claimProgressSteps.id, stepIds[i]),
          eq(claimProgressSteps.claimId, claimId)
        )
      );
  }

  return { success: true };
}
