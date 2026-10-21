"use server";

import { actionError } from "@/lib/action-errors";

import { portalActors } from "@/db/schema";
import { getActorProfiles, profileFor, hydrateActors, getActorProfile } from "@/lib/clerk-directory";
import { actorAllowsAccess } from "@/lib/clerk-profile-policy";
import { db } from "@/db";
import {
  claims,
  policies,
  agentOrganizations,
  claimNotifications,
  claimEvents,
  claimProgressSteps,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requirePermission, permissions } from "@/lib/permissions";
import { eq, and, isNull, sql, desc, notInArray, ne } from "drizzle-orm";
import { requireOrganizationAccess } from "@/lib/organization-access";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import {
  closedClaimStatuses,
  statusLabels,
  type ClaimStatus,
} from "@/lib/claim-workflow";
import { revalidatePath } from "next/cache";

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
      policyholderId: policies.userId,
      createdAt: claims.createdAt,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .where(
      and(
        eq(claims.organizationId, organizationId),
        eq(claims.status, "pending"),
        isNull(claims.assignedAgentId),
      ),
    )
    .orderBy(desc(claims.createdAt));
  const profiles = await getActorProfiles(result.map((c) => c.policyholderId));
  return result.map((claim) => ({
    policyholderName: profileFor(profiles, claim.policyholderId).name,
    policyholderEmail: profileFor(profiles, claim.policyholderId).email,
    ...claim,
    createdAt: claim.createdAt.toISOString(),
  }));
}

export async function getAgentWorkloads(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);
  await requireOrganizationAccess(session, organizationId);
  const agentRows = await db.select().from(portalActors)
    .innerJoin(agentOrganizations, eq(agentOrganizations.agentId, portalActors.id))
    .where(eq(agentOrganizations.organizationId, organizationId));
  const agents = (await hydrateActors(agentRows.map((row) => row.portal_actors)))
    .filter((agent) => agent.role === "agent" && agent.emailVerified && !agent.banned && actorAllowsAccess(agent, Date.now()));
  return Promise.all(
    agents.map(async (agent) => {
      const activeWhere = and(
        eq(claims.assignedAgentId, agent.id),
        eq(claims.organizationId, organizationId),
        notInArray(claims.status, [...closedClaimStatuses, "draft"]),
      );
      const [[count], [latest]] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(claims)
          .where(activeWhere),
        db
          .select({ id: claims.id, claimNumber: claims.claimNumber })
          .from(claims)
          .where(activeWhere)
          .orderBy(desc(claims.createdAt))
          .limit(1),
      ]);
      return {
        ...agent,
        activeClaimCount: count?.count ?? 0,
        latestClaim: latest?.claimNumber,
        latestClaimId: latest?.id,
      };
    }),
  );
}

export async function getManagedClaims(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);
  await requireOrganizationAccess(session, organizationId);
  const rows = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      openRequestCount: sql<number>`(SELECT count(*)::int FROM evidence_requests er WHERE er.claim_id = ${claims.id} AND er.status <> 'resolved')`,
      overdueRequestCount: sql<number>`(SELECT count(*)::int FROM evidence_requests er WHERE er.claim_id = ${claims.id} AND er.status <> 'resolved' AND er.due_at < now())`,
      assignedAgentId: claims.assignedAgentId,
      policyholderId: policies.userId,
      policyType: policies.policyType,
      createdAt: claims.createdAt,

    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .where(
      and(
        eq(claims.organizationId, organizationId),
        ne(claims.status, "draft"),
      ),
    )
    .orderBy(desc(claims.createdAt));
  const profiles = await getActorProfiles(rows.flatMap((c) => [c.policyholderId, c.assignedAgentId]));
  return rows.map((claim) => ({
    policyholderName: profileFor(profiles, claim.policyholderId).name,
    agentName: claim.assignedAgentId ? profileFor(profiles, claim.assignedAgentId).name : null,
    ...claim,
    openRequestCount: closedClaimStatuses.includes(claim.status)
      ? 0
      : claim.openRequestCount,
    overdueRequestCount: closedClaimStatuses.includes(claim.status)
      ? 0
      : claim.overdueRequestCount,
    createdAt: claim.createdAt.toISOString(),
  }));
}

async function changeAssignment(
  claimId: string,
  agentId: string,
  reassign: boolean,
  reason?: string,
) {
  try {
    const session = await requireSession();
    requirePermission(session.role, permissions.CLAIM_ASSIGN);
    const claim = await requireClaimAccess(session, claimId, "manage");
    if (claim.status === "draft" || closedClaimStatuses.includes(claim.status))
      return {
        success: false,
        error: "Only open submitted claims can be assigned",
      };
    if (!reassign && (claim.assignedAgentId || claim.status !== "pending"))
      return { success: false, error: "This claim has already been assigned" };
    if (
      reassign &&
      (!claim.assignedAgentId || claim.assignedAgentId === agentId)
    )
      return {
        success: false,
        error: "Choose a different agent for an assigned claim",
      };
    if (
      reassign &&
      (!reason || reason.trim().length < 5 || reason.length > 2000)
    )
      return {
        success: false,
        error: "Give a reassignment reason between 5 and 2,000 characters",
      };
    await db.transaction(async (tx) => {
      const [targetActor] = await tx.select().from(portalActors).where(eq(portalActors.id, agentId)).for("update");
      const targetProfile = await getActorProfile(agentId);
      if (!targetActor || !actorAllowsAccess(targetActor, Date.now()) || targetProfile.role !== "agent" || !targetProfile.emailVerified || targetProfile.banned)
        throw new Error("Choose an active agent");
      const target = { id: targetActor.id, name: targetProfile.name };
      const [membership] = await tx
        .select({ id: agentOrganizations.id })
        .from(agentOrganizations)
        .where(
          and(
            eq(agentOrganizations.agentId, agentId),
            eq(agentOrganizations.organizationId, claim.organizationId),
          ),
        )
        .for("update")
        .limit(1);
      if (!membership)
        throw new Error("Agent does not belong to this organization");
      await lockClaimForMutation(tx, session, claimId, claim.version);
      const [updated] = await tx
        .update(claims)
        .set({
          assignedAgentId: agentId,
          assignedBy: session.id,
          status: reassign ? claim.status : "assigned",
          version: sql`${claims.version} + 1`,
        })
        .where(
          and(
            eq(claims.id, claimId),
            eq(claims.version, claim.version),
            reassign
              ? eq(claims.assignedAgentId, claim.assignedAgentId!)
              : isNull(claims.assignedAgentId),
          ),
        )
        .returning({ id: claims.id });
      if (!updated)
        throw new Error("This claim changed. Refresh before assigning it.");
      await tx
        .update(claimProgressSteps)
        .set({
          isCompleted: true,
          completedAt: new Date(),
          completedBy: session.id,
        })
        .where(
          and(
            eq(claimProgressSteps.claimId, claimId),
            eq(claimProgressSteps.isSystem, true),
            eq(claimProgressSteps.label, "Agent assigned"),
          ),
        );
      await tx.insert(claimEvents).values({
        claimId,
        actorId: session.id,
        type: reassign ? "claim_reassigned" : "claim_assigned",
        visibility: "public",
        content: `Claim ${reassign ? "reassigned" : "assigned"} to ${target.name}.${reassign ? ` Reason: ${reason!.trim()}` : ""}`,
        metadata: {
          previousAgentId: claim.assignedAgentId,
          agentId,
          reason: reason?.trim(),
        },
      });
      const notifications = [
        {
          claimId,
          userId: agentId,
          type: "assignment",
          message: `Claim ${claim.claimNumber} has been ${reassign ? "reassigned" : "assigned"} to you.`,
        },
        {
          claimId,
          userId: claim.policyholderId,
          type: "assignment",
          message: `${target.name} is now handling claim ${claim.claimNumber}.`,
        },
      ];
      if (claim.assignedAgentId)
        notifications.push({
          claimId,
          userId: claim.assignedAgentId,
          type: "assignment",
          message: `Claim ${claim.claimNumber} has been reassigned to ${target.name}.`,
        });
      await tx.insert(claimNotifications).values(notifications);
    });
    revalidatePath("/claims");
    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/dashboard/head-agent");
    revalidatePath("/dashboard/agent");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: actionError(error, "Unable to assign the claim"),
    };
  }
}

export async function assignClaimToAgent(claimId: string, agentId: string) {
  return changeAssignment(claimId, agentId, false);
}
export async function reassignClaim(
  claimId: string,
  newAgentId: string,
  reason: string,
) {
  return changeAssignment(claimId, newAgentId, true, reason);
}

export async function getBottleneckMetrics(organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.CLAIM_READ_ALL);
  await requireOrganizationAccess(session, organizationId);
  const rows = await db
    .select({ stage: claims.status, count: sql<number>`COUNT(*)::int` })
    .from(claims)
    .where(
      and(
        eq(claims.organizationId, organizationId),
        notInArray(claims.status, [...closedClaimStatuses, "draft"]),
      ),
    )
    .groupBy(claims.status);
  const stages: ClaimStatus[] = [
    "pending",
    "assigned",
    "awaiting_information",
    "surveyor_dispatched",
    "under_review",
    "assessment_complete",
    "approved",
  ];
  return stages.map((stage) => ({
    stage,
    label: statusLabels[stage],
    count: rows.find((row) => row.stage === stage)?.count ?? 0,
  }));
}
