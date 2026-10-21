"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { invitations, portalActors } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { safeAuthContinuation } from "@/lib/auth-navigation";
import { hashInvitationToken, invitationState, normalizeEmail } from "@/lib/invitation-policy";
import { clerkSessionIsCurrent } from "@/lib/clerk-identity-policy";
import { getAuthenticatedClerkIdentity } from "@/lib/session";
import { getPortalDatabaseAvailability } from "@/lib/portal-actor-store";

/** Explicit reference creation; profiles and roles are never copied into PostgreSQL. */
export async function connectClerkAccount(form: FormData) {
  const next = safeAuthContinuation(String(form.get("next") || ""));
  const identity = await getAuthenticatedClerkIdentity();
  if (!identity) {
    if ((await auth()).userId) redirect(`/auth/continue?next=${encodeURIComponent(next)}&error=account`);
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  if (!identity.emailVerified) redirect(`/auth/continue?next=${encodeURIComponent(next)}&error=verification`);
  if (await getPortalDatabaseAvailability() !== "ready")
    redirect(`/auth/continue?next=${encodeURIComponent(next)}`);
  let failure = "";
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`clerk:${identity.clerkUserId}`}, 0))`);
      let [actor] = await tx.select().from(portalActors)
        .where(eq(portalActors.clerkUserId, identity.clerkUserId)).for("update");
      if (!actor && identity.linkedActorId) {
        const [legacy] = await tx.select().from(portalActors).where(eq(portalActors.id, identity.linkedActorId)).for("update");
        if (!legacy || (legacy.clerkUserId && legacy.clerkUserId !== identity.clerkUserId)) throw new Error("linked");
        [actor] = await tx.update(portalActors).set({ clerkUserId: identity.clerkUserId })
          .where(and(eq(portalActors.id, legacy.id), isNull(portalActors.clerkUserId))).returning();
        if (!actor) throw new Error("linked");
      }
      if (actor?.suspendedAt || actor?.retiredAt) throw new Error("suspended");
      if (actor?.pendingRoleOperationId) throw new Error("pending");
      if (actor?.sessionsValidAfter) {
        const session = await (await clerkClient()).sessions.getSession(identity.clerkSessionId);
        if (!clerkSessionIsCurrent(session.createdAt, actor.sessionsValidAfter)) throw new Error("revoked");
      }
      const token = /^\/invitations\/([a-f0-9]{64})$/.exec(next)?.[1];
      const [invitation] = token ? await tx.select().from(invitations)
        .where(eq(invitations.token, hashInvitationToken(token))).for("share") : [];
      const invited = !!invitation && invitationState(invitation) === "pending" && normalizeEmail(invitation.email) === identity.email;
      if (!actor && !invited && identity.role !== "admin") throw new Error("invitation");
      if (!actor) [actor] = await tx.insert(portalActors).values({
        clerkUserId: identity.clerkUserId,
        enrolledAt: identity.role === "admin" ? new Date() : null,
      }).returning();
      if (!actor.enrolledAt && identity.role === "admin")
        await tx.update(portalActors).set({ enrolledAt: new Date() }).where(eq(portalActors.id, actor.id));
      if (!actor.enrolledAt && identity.role !== "admin" && !invited) throw new Error("invitation");
      if (actor.enrolledAt && !identity.role) throw new Error("role");
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "connection";
    failure = ["revoked", "suspended", "pending", "invitation", "linked", "role"].includes(reason) ? reason : "connection";
  }
  if (failure) redirect(`/auth/continue?next=${encodeURIComponent(next)}&error=${failure}`);
  redirect(next);
}
