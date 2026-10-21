import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { claimStatusEnum } from "./enums";
import { portalActors } from "./portal-actors";
import { policies } from "./policies";
import { organizations } from "./organizations";

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimNumber: varchar("claim_number", { length: 50 }).notNull().unique(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  status: claimStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  formData: jsonb("form_data").$type<Record<string, unknown>>(),
  originalSubmission: jsonb("original_submission").$type<
    Record<string, unknown>
  >(),
  policySnapshot: jsonb("policy_snapshot").$type<Record<string, unknown>>(),
  formVersion: varchar("form_version", { length: 20 })
    .notNull()
    .default("fnol-v1"),
  version: integer("version").notNull().default(1),
  incidentDate: varchar("incident_date", { length: 10 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  assessmentSummary: text("assessment_summary"),
  estimatedLossAmount: numeric("estimated_loss_amount", {
    precision: 14,
    scale: 2,
  }),
  assessedBy: uuid("assessed_by").references(() => portalActors.id),
  assessedAt: timestamp("assessed_at"),
  createdBy: uuid("created_by").references(() => portalActors.id),
  submittedBy: uuid("submitted_by").references(() => portalActors.id),
  submittedAt: timestamp("submitted_at"),
  outcomeReason: text("outcome_reason"),
  outcomeSource: varchar("outcome_source", { length: 20 }),
  withdrawalRequestedAt: timestamp("withdrawal_requested_at"),
  withdrawalReason: text("withdrawal_reason"),
  carrierReference: varchar("carrier_reference", { length: 100 }),
  carrierHandoffState: varchar("carrier_handoff_state", { length: 20 })
    .notNull()
    .default("not_sent"),
  settlementAmount: numeric("settlement_amount", { precision: 14, scale: 2 }),
  settlementReference: varchar("settlement_reference", { length: 100 }),
  settlementRecordedAt: timestamp("settlement_recorded_at"),
  assignedAgentId: uuid("assigned_agent_id").references(() => portalActors.id),
  assignedBy: uuid("assigned_by").references(() => portalActors.id),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
