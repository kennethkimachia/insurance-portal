import { pgTable, uuid, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { policyTypeEnum } from "./enums";
import { user } from "./auth";
import { organizations } from "./organizations";

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyNumber: varchar("policy_number", { length: 50 }).notNull().unique(),
    policyType: policyTypeEnum("policy_type").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_policy_type_unique").on(table.userId, table.policyType),
  ]
);
