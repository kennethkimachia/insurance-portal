import { pgTable, uuid, varchar, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { portalActors } from "./portal-actors";
import { invitations } from "./invitations";
import { userRoleEnum } from "./enums";

export const clerkRoleOperations = pgTable("clerk_role_operations", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => portalActors.id),
  clerkUserId: text("clerk_user_id").notNull(),
  invitationId: uuid("invitation_id").references(() => invitations.id),
  requestedBy: uuid("requested_by").notNull().references(() => portalActors.id),
  desiredRole: userRoleEnum("desired_role").notNull(),
  previousRole: userRoleEnum("previous_role"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: varchar("status", { length: 20 }).$type<"pending" | "processing" | "applied" | "cancelled" | "blocked">().notNull().default("pending"),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  uniqueIndex("clerk_role_operations_active_actor_uq").on(table.actorId)
    .where(sql`${table.status} in ('pending', 'processing', 'blocked')`),
]);
