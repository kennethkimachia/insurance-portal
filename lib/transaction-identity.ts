import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { portalActors, policyholderEnrollments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { SessionUser } from "./session";
import { readCurrentClerkProfile } from "./clerk-directory";
import { actorAllowsAccess } from "./clerk-profile-policy";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Recheck local gates under lock, using the request's current backend role. */
export async function assertCurrentActor(tx: Transaction, actor: SessionUser) {
  const [identity] = await tx.select().from(portalActors).where(eq(portalActors.id, actor.id)).limit(1);
  const profile = await readCurrentClerkProfile(actor.clerkUserId);
  const createdAt = identity?.sessionsValidAfter && actor.sessionCreatedAt === null
    ? (await (await clerkClient()).sessions.getSession(actor.clerkSessionId)).createdAt : actor.sessionCreatedAt;
  if (!identity || identity.clerkUserId !== actor.clerkUserId || !actorAllowsAccess(identity, createdAt) ||
      !profile.available || profile.banned || !profile.emailVerified || profile.role !== actor.role)
    throw new Error("Your access changed. Sign in again before continuing.");
  const [enrollment] = await tx.select().from(policyholderEnrollments).where(eq(policyholderEnrollments.actorId, actor.id)).limit(1);
  return { ...identity, role: profile.role, emailVerified: true, email: profile.email, name: profile.name,
    organizationId: enrollment?.organizationId || null, phone: enrollment?.phone || profile.phone };
}

/** Lock actor and targets in a stable order, then recheck current access. */
export async function requireCurrentActor(tx: Transaction, actor: SessionUser, targetIds: string[] = []) {
  const ids = [...new Set([actor.id, ...targetIds])].sort();
  await tx.select({ id: portalActors.id }).from(portalActors).where(inArray(portalActors.id, ids)).orderBy(portalActors.id).for("update");
  return assertCurrentActor(tx, actor);
}
