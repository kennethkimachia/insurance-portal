import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { claims } from "./claims";

export const claimNotifications = pgTable("claim_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  type: varchar("type", { length: 50 }).notNull(), // 'status_change' | 'note_added'
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
