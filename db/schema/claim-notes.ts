import { pgTable, uuid, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { portalActors } from "./portal-actors";
import { claims } from "./claims";

export const claimNotes = pgTable("claim_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => portalActors.id),
  content: text("content").notNull(),
  visibility: varchar("visibility", { length: 20 })
    .notNull()
    .default("internal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
