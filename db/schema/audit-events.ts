import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { portalActors } from "./portal-actors";
import { organizations } from "./organizations";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  actorId: uuid("actor_id").references(() => portalActors.id),
  targetUserId: uuid("target_user_id").references(() => portalActors.id),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
