import type { Role } from "./permissions";

export interface ClerkProfileInput {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
  primaryPhoneNumberId?: string | null;
  phoneNumbers?: { id: string; phoneNumber: string }[];
  publicMetadata: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  banned: boolean;
}

export function parsePortalRole(value: unknown): Role | null {
  return value === "admin" || value === "head_agent" || value === "agent" || value === "user" ? value : null;
}

export function projectClerkProfile(profile: ClerkProfileInput) {
  const primary = profile.emailAddresses.find((entry) => entry.id === profile.primaryEmailAddressId);
  const rawRole = profile.publicMetadata.portalRole;
  return {
    clerkUserId: profile.id,
    name: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || primary?.emailAddress || "Account holder",
    email: primary?.emailAddress.trim().toLowerCase() || "",
    emailVerified: primary?.verification?.status === "verified",
    image: profile.imageUrl,
    phone: profile.phoneNumbers?.find((entry) => entry.id === profile.primaryPhoneNumberId)?.phoneNumber || null,
    role: parsePortalRole(rawRole),
    invalidRole: rawRole !== undefined && rawRole !== null && parsePortalRole(rawRole) === null,
    banned: profile.banned,
    linkedActorId: typeof profile.privateMetadata?.portalActorId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(profile.privateMetadata.portalActorId)
      ? profile.privateMetadata.portalActorId : null,
    available: true,
  };
}

export type PortalProfile = ReturnType<typeof projectClerkProfile>;

export function unavailableProfile(clerkUserId = ""): PortalProfile {
  return { clerkUserId, name: "Account unavailable", email: "", emailVerified: false,
    image: "", phone: null, role: null, invalidRole: false, banned: true, linkedActorId: null, available: false };
}

export function actorAllowsAccess(actor: {
  enrolledAt: Date | null;
  suspendedAt: Date | null;
  retiredAt: Date | null;
  pendingRoleOperationId: string | null;
  sessionsValidAfter: Date | null;
}, sessionCreatedAt: number | null): boolean {
  return !!actor.enrolledAt && !actor.suspendedAt && !actor.retiredAt && !actor.pendingRoleOperationId &&
    (!actor.sessionsValidAfter || (sessionCreatedAt !== null && sessionCreatedAt > actor.sessionsValidAfter.getTime()));
}

/** Bounded directory reads, including pagination and defensive response filtering. */
export async function loadClerkProfiles<T extends { id: string }>(ids: string[], load: (
  params: { userId: string[]; limit: number; offset: number },
) => Promise<{ data: T[]; totalCount: number }>): Promise<Map<string, T>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const profiles = new Map<string, T>();
  for (let start = 0; start < unique.length; start += 100) {
    const batch = unique.slice(start, start + 100);
    const requested = new Set(batch);
    let offset = 0;
    for (;;) {
      const result = await load({ userId: batch, limit: 100, offset });
      for (const profile of result.data) if (requested.has(profile.id)) profiles.set(profile.id, profile);
      offset += result.data.length;
      if (offset >= result.totalCount || result.data.length === 0) break;
      if (offset >= batch.length) throw new Error("Clerk directory pagination returned an inconsistent count.");
    }
  }
  return profiles;
}
