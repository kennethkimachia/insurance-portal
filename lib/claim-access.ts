import { db } from "@/db";
import { claims, policies, portalActors, organizations, agentOrganizations } from "@/db/schema";
import type { SessionUser } from "./session";
import { canAccessOrganization } from "./organization-access";
import { canAccessClaim, type ClaimAccessPurpose } from "./claim-access-policy";
import { eq, and, getTableColumns } from "drizzle-orm";
import { assertCurrentActor } from "./transaction-identity";
import { getActorProfiles, profileFor } from "./clerk-directory";

export { canAccessClaim } from "./claim-access-policy";
export type ClaimTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockClaimForMutation(tx: ClaimTransaction, session: SessionUser, claimId: string,
  expectedVersion?: number, purpose: ClaimAccessPurpose = "manage") {
  await tx.select({ id: portalActors.id }).from(portalActors).where(eq(portalActors.id, session.id)).for("share");
  const actor = await assertCurrentActor(tx, session);
  const [claim] = await tx.select({ ...getTableColumns(claims), policyholderId: policies.userId })
    .from(claims).innerJoin(policies, eq(policies.id, claims.policyId)).where(eq(claims.id, claimId))
    .for("update", { of: claims }).limit(1);
  if (!claim) throw new Error("Claim not found or access denied");
  let membership = session.role === "admin";
  if (session.role !== "user" && session.role !== "admin") {
    const [member] = await tx.select().from(agentOrganizations)
      .where(and(eq(agentOrganizations.agentId, session.id), eq(agentOrganizations.organizationId, claim.organizationId)))
      .for("share").limit(1);
    membership = Boolean(member);
  }
  if (!canAccessClaim(actor.role, actor.id, claim, membership, purpose)) throw new Error("Claim not found or access denied");
  if (expectedVersion !== undefined && claim.version !== expectedVersion) throw new Error("This claim changed. Refresh and try again.");
  return claim;
}

export async function requireClaimAccess(session: SessionUser, claimId: string, purpose: ClaimAccessPurpose = "read") {
  if (!session.emailVerified) throw new Error("Verify your email before accessing claims");
  const [claim] = await db.select({ ...getTableColumns(claims), policyholderId: policies.userId,
    policyNumber: policies.policyNumber, policyType: policies.policyType, organizationName: organizations.name })
    .from(claims).innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(organizations, eq(organizations.id, claims.organizationId)).where(eq(claims.id, claimId)).limit(1);
  if (!claim) throw new Error("Claim not found or access denied");
  const member = session.role === "user" ? false : await canAccessOrganization(session, claim.organizationId);
  if (!canAccessClaim(session.role, session.id, claim, member, purpose)) throw new Error("Claim not found or access denied");
  const profiles = await getActorProfiles([claim.policyholderId, claim.assignedAgentId]);
  const holder = profileFor(profiles, claim.policyholderId);
  const agent = claim.assignedAgentId ? profileFor(profiles, claim.assignedAgentId) : null;
  return { ...claim, policyholderName: holder.name, policyholderEmail: holder.email,
    agentName: agent?.name || null, agentEmail: agent?.email || null };
}
