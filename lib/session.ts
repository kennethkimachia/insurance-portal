"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Role } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

/**
 * Get the current authenticated session user.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as {
    id: string;
    name: string;
    email: string;
    role?: string;
    organizationId?: string;
  };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role as Role) || "user",
    organizationId: user.organizationId || null,
  };
}

/**
 * Get the current session user or throw if not authenticated.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
