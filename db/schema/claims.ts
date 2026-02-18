import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { claimStatusEnum } from "./enums";
import { user } from "./auth";
import { policies } from "./policies";
import { organizations } from "./organizations";

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimNumber: varchar("claim_number", { length: 50 }).notNull().unique(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  status: claimStatusEnum("status").notNull().default("pending"),
  description: text("description"),
  assignedAgentId: uuid("assigned_agent_id").references(() => user.id),
  assignedBy: uuid("assigned_by").references(() => user.id),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
