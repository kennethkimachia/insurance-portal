import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { policyTypeEnum } from "./enums";
import { portalActors } from "./portal-actors";
import { organizations } from "./organizations";

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyNumber: varchar("policy_number", { length: 50 }).notNull().unique(),
    policyType: policyTypeEnum("policy_type").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => portalActors.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    coverageStart: varchar("coverage_start", { length: 10 }),
    coverageEnd: varchar("coverage_end", { length: 10 }),
    insuredAsset: text("insured_asset"),
    coverageSummary: text("coverage_summary"),
    insurerReference: varchar("insurer_reference", { length: 100 }),
    source: varchar("source", { length: 20 }).notNull().default("demo"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_policy_type_unique").on(table.userId, table.policyType),
  ],
);
