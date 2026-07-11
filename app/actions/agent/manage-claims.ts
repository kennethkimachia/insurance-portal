"use server";

import { db } from "@/db";
import {
  claims,
  policies,
  claimNotes,
  claimNotifications,
  claimAttachments,
  motorClaimDetails,
  burglaryClaimDetails,
  user,
  organizations,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";

// ── Get my assigned claims ─────────────────────────────────────────────

export async function getMyAssignedClaims() {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_UPDATE_STATUS);

  const result = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      policyType: policies.policyType,
      policyholderName: user.name,
      organizationName: organizations.name,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(user, eq(user.id, policies.userId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(eq(claims.assignedAgentId, session.id))
    .orderBy(desc(claims.createdAt));

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ── Get full claim details ─────────────────────────────────────────────

export async function getClaimDetails(claimId: string) {
  const session = await requireSession();

  const [claim] = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      assignedAgentId: claims.assignedAgentId,
      policyId: claims.policyId,
      policyNumber: policies.policyNumber,
      policyType: policies.policyType,
      policyholderName: user.name,
      policyholderEmail: user.email,
      organizationId: claims.organizationId,
      organizationName: organizations.name,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(user, eq(user.id, policies.userId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId))
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return null;

  // Auth check — only the assigned agent, head_agent, or admin can view
  if (session.role === "agent" && claim.assignedAgentId !== session.id) {
    return null;
  }

  return {
    ...claim,
    createdAt: claim.createdAt.toISOString(),
  };
}

// ── Update claim status ────────────────────────────────────────────────

type ClaimStatus =
  | "pending"
  | "assigned"
  | "surveyor_dispatched"
  | "under_review"
  | "assessment_complete"
  | "approved"
  | "settled"
  | "rejected";

const STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: "Submitted",
  assigned: "Assigned",
  surveyor_dispatched: "Surveyor Dispatched",
  under_review: "Under Review",
  assessment_complete: "Assessment Complete",
  approved: "Approved",
  settled: "Settled",
  rejected: "Rejected",
};

export async function updateClaimStatus(claimId: string, newStatus: ClaimStatus) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_UPDATE_STATUS);

  const [claim] = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      assignedAgentId: claims.assignedAgentId,
      policyId: claims.policyId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return { success: false, error: "Claim not found" };

  // Only the assigned agent (or head_agent/admin) can update
  if (session.role === "agent" && claim.assignedAgentId !== session.id) {
    return { success: false, error: "This claim is not assigned to you" };
  }

  await db
    .update(claims)
    .set({ status: newStatus })
    .where(eq(claims.id, claimId));

  // Notify policyholder
  const [policy] = await db
    .select({ userId: policies.userId })
    .from(policies)
    .where(eq(policies.id, claim.policyId))
    .limit(1);

  if (policy) {
    await db.insert(claimNotifications).values({
      claimId: claim.id,
      userId: policy.userId,
      type: "status_change",
      message: `Your claim ${claim.claimNumber} has been updated to "${STATUS_LABELS[newStatus]}".`,
    });
  }

  // Also add a system note to the timeline
  await db.insert(claimNotes).values({
    claimId: claim.id,
    authorId: session.id,
    content: `Status updated to "${STATUS_LABELS[newStatus]}".`,
  });

  return { success: true };
}

// ── Add claim note ─────────────────────────────────────────────────────

export async function addClaimNote(claimId: string, content: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.NOTE_CREATE);

  if (!content.trim()) {
    return { success: false, error: "Note content is required" };
  }

  const [claim] = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      assignedAgentId: claims.assignedAgentId,
      policyId: claims.policyId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return { success: false, error: "Claim not found" };

  if (session.role === "agent" && claim.assignedAgentId !== session.id) {
    return { success: false, error: "This claim is not assigned to you" };
  }

  await db.insert(claimNotes).values({
    claimId: claim.id,
    authorId: session.id,
    content: content.trim(),
  });

  // Notify the policyholder
  const [policy] = await db
    .select({ userId: policies.userId })
    .from(policies)
    .where(eq(policies.id, claim.policyId))
    .limit(1);

  if (policy) {
    await db.insert(claimNotifications).values({
      claimId: claim.id,
      userId: policy.userId,
      type: "note_added",
      message: `A new update has been posted on your claim ${claim.claimNumber}.`,
    });
  }

  return { success: true };
}

// ── Get claim timeline ─────────────────────────────────────────────────

export async function getClaimTimeline(claimId: string) {
  const session = await requireSession();

  const notes = await db
    .select({
      id: claimNotes.id,
      content: claimNotes.content,
      authorId: claimNotes.authorId,
      authorName: user.name,
      authorRole: user.role,
      createdAt: claimNotes.createdAt,
    })
    .from(claimNotes)
    .innerJoin(user, eq(user.id, claimNotes.authorId))
    .where(eq(claimNotes.claimId, claimId))
    .orderBy(asc(claimNotes.createdAt));

  return notes.map((n) => ({
    id: n.id,
    author: n.authorName,
    role: n.authorRole as string,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  }));
}
