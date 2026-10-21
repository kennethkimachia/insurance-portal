import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";
import { db } from "@/db";
import { portalActors } from "@/db/schema";
import { inArray, eq, desc } from "drizzle-orm";
import { loadClerkProfiles, projectClerkProfile, unavailableProfile, type PortalProfile } from "./clerk-profile-policy";

/** Security checks use current backend state; this cache lasts only one request. */
export async function readCurrentClerkProfile(clerkUserId: string): Promise<PortalProfile> {
  try {
    return projectClerkProfile(await (await clerkClient()).users.getUser(clerkUserId));
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404)
      return unavailableProfile(clerkUserId);
    throw new Error("Account verification is unavailable. Please retry.");
  }
}
export const getClerkProfile = cache(readCurrentClerkProfile);

/** Call only with local actor IDs from already-authorized business records. */
export async function getActorProfiles(actorIds: (string | null | undefined)[]): Promise<Map<string, PortalProfile>> {
  const ids = [...new Set(actorIds.filter((id): id is string => !!id))];
  if (!ids.length) return new Map();
  const actors = await db.select({ id: portalActors.id, clerkUserId: portalActors.clerkUserId })
    .from(portalActors).where(inArray(portalActors.id, ids));
  const client = await clerkClient();
  const users = await loadClerkProfiles(actors.flatMap((actor) => actor.clerkUserId ? [actor.clerkUserId] : []),
    (params) => client.users.getUserList(params));
  return new Map(actors.map((actor) => {
    const profile = actor.clerkUserId ? users.get(actor.clerkUserId) : undefined;
    return [actor.id, profile ? projectClerkProfile(profile) : unavailableProfile(actor.clerkUserId || "")];
  }));
}

export function profileFor(profiles: Map<string, PortalProfile>, actorId?: string | null): PortalProfile {
  return (actorId ? profiles.get(actorId) : undefined) || unavailableProfile();
}

export async function getActorProfile(actorId: string): Promise<PortalProfile> {
  const [actor] = await db.select().from(portalActors).where(eq(portalActors.id, actorId)).limit(1);
  return actor?.clerkUserId ? readCurrentClerkProfile(actor.clerkUserId) : unavailableProfile();
}

export async function hydrateActors<T extends { id: string }>(actors: T[]) {
  const profiles = await getActorProfiles(actors.map((actor) => actor.id));
  return actors.map((actor) => ({ ...actor, ...profileFor(profiles, actor.id), id: actor.id,
    phone: "phone" in actor ? actor.phone as string | null : profileFor(profiles, actor.id).phone }));
}

export async function listPortalStaff() {
  const actors = await db.select().from(portalActors).orderBy(desc(portalActors.createdAt));
  return (await hydrateActors(actors)).filter((actor) => actor.enrolledAt && actor.role && actor.role !== "user");
}

export async function hydrateAssignments<T extends { agentId: string }>(rows: T[]) {
  const profiles = await getActorProfiles(rows.map((row) => row.agentId));
  return rows.map((row) => ({ ...row, agentName: profileFor(profiles, row.agentId).name,
    agentEmail: profileFor(profiles, row.agentId).email }));
}

/** Exact verified primary email is used only for invitation eligibility, never ownership. */
export async function findClerkProfileByEmail(email: string): Promise<PortalProfile | null> {
  const normalized = email.trim().toLowerCase();
  const client = await clerkClient();
  const response = await client.users.getUserList({ emailAddress: [normalized], limit: 100 });
  const matches = response.data.map(projectClerkProfile).filter((profile) => profile.email === normalized);
  if (response.totalCount > response.data.length || matches.length > 1)
    throw new Error("Account matching needs administrator review.");
  return matches[0] || null;
}
