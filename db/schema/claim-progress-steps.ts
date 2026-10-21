import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { portalActors } from "./portal-actors";
import { claims } from "./claims";

export const claimProgressSteps = pgTable("claim_progress_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  stepOrder: integer("step_order").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  description: text("description"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedBy: uuid("completed_by").references(() => portalActors.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
