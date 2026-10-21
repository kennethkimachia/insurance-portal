import { pgTable, uuid, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/** References and portal access state only. Clerk owns profiles and global roles. */
export const portalActors = pgTable("portal_actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  enrolledAt: timestamp("enrolled_at"),
  suspendedAt: timestamp("suspended_at"),
  suspensionReason: text("suspension_reason"),
  sessionsValidAfter: timestamp("sessions_valid_after"),
  pendingRoleOperationId: uuid("pending_role_operation_id"),
  retiredAt: timestamp("retired_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

/** Agent-recorded contact information belongs to insurance enrollment. */
export const policyholderEnrollments = pgTable("policyholder_enrollments", {
  actorId: uuid("actor_id").primaryKey().references(() => portalActors.id),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
