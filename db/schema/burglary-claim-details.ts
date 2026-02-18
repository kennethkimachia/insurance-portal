import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { claims } from "./claims";

export const burglaryClaimDetails = pgTable("burglary_claim_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .unique()
    .references(() => claims.id),

  // Premises
  premisesLocation: text("premises_location").notNull(),
  buildingType: varchar("building_type", { length: 30 }).notNull(),
  wasAnyoneHome: varchar("was_anyone_home", { length: 5 }).notNull(), // "yes" | "no"

  // Entry
  entryMethod: text("entry_method").notNull(),
  evidenceOfViolence: varchar("evidence_of_violence", { length: 5 }).notNull(), // "yes" | "no"

  // Security
  alarmFitted: varchar("alarm_fitted", { length: 5 }).notNull(), // "yes" | "no"
  alarmActiveAtTime: varchar("alarm_active_at_time", { length: 5 }).notNull(), // "yes" | "no" | "n_a"
  securityFirmName: varchar("security_firm_name", { length: 100 }),
  exteriorLockTypes: text("exterior_lock_types").notNull(),

  // Police
  policeStation: varchar("police_station", { length: 100 }).notNull(),
  dateReported: varchar("date_reported", { length: 20 }).notNull(),
  obNumber: varchar("ob_number", { length: 50 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const burglaryLossItems = pgTable("burglary_loss_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  burglaryDetailId: uuid("burglary_detail_id")
    .notNull()
    .references(() => burglaryClaimDetails.id),
  description: text("description").notNull(),
  purchaseDate: varchar("purchase_date", { length: 20 }).notNull(),
  originalCost: varchar("original_cost", { length: 20 }).notNull(),
  replacementValue: varchar("replacement_value", { length: 20 }).notNull(),
});
