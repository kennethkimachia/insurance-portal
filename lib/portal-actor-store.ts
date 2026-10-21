import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { portalActors, policyholderEnrollments } from "@/db/schema";
import {
  portalDatabaseFailure,
  portalTablesAvailability,
  readWhenPortalReady,
  type PortalDatabaseAvailability,
} from "./portal-database-policy";

/** Request-local only: the next refresh must recheck a newly applied cutover. */
export const getPortalDatabaseAvailability = cache(async (): Promise<PortalDatabaseAvailability> => {
  try {
    const result = await db.execute<{
      actors: boolean; enrollments: boolean; roleOperations: boolean;
    }>(sql`select
      to_regclass('portal_actors') is not null as actors,
      to_regclass('policyholder_enrollments') is not null as enrollments,
      to_regclass('clerk_role_operations') is not null as "roleOperations"`);
    return portalTablesAvailability(result.rows[0]);
  } catch (error) {
    return portalDatabaseFailure(error);
  }
});

/** Call with the current authenticated Clerk ID, never a client-supplied ID. */
export const getPortalActorRecord = cache(async (clerkUserId: string) =>
  readWhenPortalReady(getPortalDatabaseAvailability, async () => {
    const [record] = await db.select({ actor: portalActors, enrollment: policyholderEnrollments })
      .from(portalActors)
      .leftJoin(policyholderEnrollments, eq(policyholderEnrollments.actorId, portalActors.id))
      .where(eq(portalActors.clerkUserId, clerkUserId)).limit(1);
    return record ?? null;
  }),
);
