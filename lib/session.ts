import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";
import type { Role } from "./permissions";
import { getClerkProfile } from "./clerk-directory";
import { actorAllowsAccess } from "./clerk-profile-policy";
import { getPortalActorRecord } from "./portal-actor-store";
import { portalDatabaseMessages } from "./portal-database-policy";

export interface SessionUser {
  id: string;
  clerkUserId: string;
  clerkSessionId: string;
  sessionCreatedAt: number | null;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  organizationId: string | null;
  emailVerified: boolean;
  phone: string | null;
}

export const getAuthenticatedClerkIdentity = cache(async () => {
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return null;
  const profile = await getClerkProfile(userId);
  if (!profile.available || profile.banned || profile.invalidRole) return null;
  return { ...profile, clerkSessionId: sessionId };
});

const readSessionUser = cache(async (): Promise<SessionUser | null> => {
  const identity = await getAuthenticatedClerkIdentity();
  if (!identity?.emailVerified || !identity.role) return null;
  const result = await getPortalActorRecord(identity.clerkUserId);
  if (result.status !== "ready") return null;
  const record = result.data;
  if (!record) return null;
  const sessionCreatedAt = record.actor.sessionsValidAfter
    ? (await (await clerkClient()).sessions.getSession(identity.clerkSessionId)).createdAt : null;
  if (!actorAllowsAccess(record.actor, sessionCreatedAt)) return null;
  return {
    id: record.actor.id,
    clerkUserId: identity.clerkUserId,
    clerkSessionId: identity.clerkSessionId,
    sessionCreatedAt,
    name: identity.name, email: identity.email, image: identity.image,
    role: identity.role, organizationId: record.enrollment?.organizationId || null,
    emailVerified: true, phone: record.enrollment?.phone || identity.phone,
  };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  return readSessionUser();
}

export async function requireSession(): Promise<SessionUser> {
  const identity = await getSessionUser();
  if (!identity) {
    const clerkIdentity = await getAuthenticatedClerkIdentity();
    if (clerkIdentity) {
      const record = await getPortalActorRecord(clerkIdentity.clerkUserId);
      if (record.status !== "ready") throw new Error(portalDatabaseMessages[record.status]);
    }
    throw new Error("Sign in and complete portal enrollment before continuing.");
  }
  return identity;
}
