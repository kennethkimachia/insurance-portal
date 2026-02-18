import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { userRoleEnum, invitationStatusEnum } from "./enums";
import { user } from "./auth";
import { organizations } from "./organizations";

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => user.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
