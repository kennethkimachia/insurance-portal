"use server";

import { db } from "@/db";
import {
  claims,
  policies,
  user,
  organizations,
  agentOrganizations,
  claimNotifications,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { requireOrganizationAccess } from "@/lib/organization-access";

// ── Get unassigned claims for the head agent's organization ────────────

export async function getUnassignedClaims(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);

  await requireOrganizationAccess(session, organizationId);
  const result = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      policyType: policies.policyType,
      policyholderName: user.name,
      policyholderEmail: user.email,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(user, eq(user.id, policies.userId))
    .where(
      and(
        eq(claims.organizationId, organizationId),
        eq(claims.status, "pending"),
        isNull(claims.assignedAgentId)
      )
    )
    .orderBy(desc(claims.createdAt));

  return result.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));
}

// ── Get agent workloads ────────────────────────────────────────────────

export async function getAgentWorkloads(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);

  await requireOrganizationAccess(session, organizationId);
  // Get all agents in this org
  const agents = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .innerJoin(agentOrganizations, eq(agentOrganizations.agentId, user.id))
    .where(
      and(
        eq(agentOrganizations.organizationId, organizationId),
        eq(user.role, "agent")
      )
    );

  // Count active claims per agent
  const workloads = await Promise.all(
    agents.map(async (agent) => {
      const [result] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(claims)
        .where(
          and(
            eq(claims.assignedAgentId, agent.id),
            eq(claims.organizationId, organizationId)
          )
        );

      // Get the latest claim number for this agent
      const [latestClaim] = await db
        .select({ claimNumber: claims.claimNumber })
        .from(claims)
        .where(eq(claims.assignedAgentId, agent.id))
        .orderBy(desc(claims.createdAt))
        .limit(1);

      return {
        ...agent,
        activeClaimCount: result?.count ?? 0,
        latestClaim: latestClaim?.claimNumber,
      };
    })
  );

  return workloads;
}

// ── Assign claim to agent ──────────────────────────────────────────────

export async function assignClaimToAgent(claimId: string, agentId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_ASSIGN);

  // Verify claim exists and is unassigned
  // The head agent and target agent must both belong to the claim organization.
  const [claim] = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      policyId: claims.policyId,
      organizationId: claims.organizationId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) {
    return { success: false, error: "Claim not found" };
  await requireOrganizationAccess(session, claim.organizationId);
  }

  // Verify agent belongs to the same org
  const agentOrg = await db
    .select({ id: agentOrganizations.id })
    .from(agentOrganizations)
    .where(
      and(
        eq(agentOrganizations.agentId, agentId),
        eq(agentOrganizations.organizationId, claim.organizationId)
      )
    )
    .limit(1);

  if (agentOrg.length === 0) {
    return { success: false, error: "Agent does not belong to this organization" };
  }

  // Assign the agent and update status
  await db
    .update(claims)
    .set({
      assignedAgentId: agentId,
      assignedBy: session.id,
      status: "assigned",
    })
    .where(eq(claims.id, claimId));

  // Notify the agent
  await db.insert(claimNotifications).values({
    claimId: claim.id,
    userId: agentId,
    type: "status_change",
    message: `Claim ${claim.claimNumber} has been assigned to you.`,
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
      type: "status_change",
      message: `Your claim ${claim.claimNumber} has been assigned to an agent and is being processed.`,
    });
  }

  return { success: true };
}

// ── Reassign claim ─────────────────────────────────────────────────────

export async function reassignClaim(claimId: string, newAgentId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_ASSIGN);

  const [claim] = await db
  // Reassignment is restricted to the same organization as the claim.
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      assignedAgentId: claims.assignedAgentId,
      organizationId: claims.organizationId,
    })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);

  if (!claim) return { success: false, error: "Claim not found" };
  await requireOrganizationAccess(session, claim.organizationId);

  // Verify new agent is in the org
  const agentOrg = await db
    .select({ id: agentOrganizations.id })
    .from(agentOrganizations)
    .where(
      and(
        eq(agentOrganizations.agentId, newAgentId),
        eq(agentOrganizations.organizationId, claim.organizationId)
      )
    )
    .limit(1);

  if (agentOrg.length === 0) {
    return { success: false, error: "Agent does not belong to this organization" };
  }

  const previousAgentId = claim.assignedAgentId;

  await db
    .update(claims)
    .set({
      assignedAgentId: newAgentId,
      assignedBy: session.id,
    })
    .where(eq(claims.id, claimId));

  // Notify new agent
  await db.insert(claimNotifications).values({
    claimId: claim.id,
    userId: newAgentId,
    type: "status_change",
    message: `Claim ${claim.claimNumber} has been reassigned to you.`,
  });

  // Notify previous agent if there was one
  if (previousAgentId) {
    await db.insert(claimNotifications).values({
      claimId: claim.id,
      userId: previousAgentId,
      type: "status_change",
      message: `Claim ${claim.claimNumber} has been reassigned to another agent.`,
    });
  }

  return { success: true };
}

// ── Bottleneck metrics ─────────────────────────────────────────────────

export async function getBottleneckMetrics(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);

  await requireOrganizationAccess(session, organizationId);
  const statuses = [
    "pending",
    "assigned",
    "surveyor_dispatched",
    "under_review",
    "assessment_complete",
    "approved",
  ] as const;

  const labels: Record<string, string> = {
    pending: "Pending",
    assigned: "Assigned",
    surveyor_dispatched: "Surveyor Dispatched",
    under_review: "Under Review",
    assessment_complete: "Assessment Complete",
    approved: "Approved → Settled",
  };

  const metrics = await Promise.all(
    statuses.map(async (status) => {
      const [result] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(claims)
        .where(
          and(
            eq(claims.organizationId, organizationId),
            eq(claims.status, status)
          )
        );

      return {
        stage: status,
        label: labels[status],
        count: result?.count ?? 0,
      };
    })
  );

  return metrics;
}
