import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
} from "drizzle-orm/pg-core";
import { userRoleEnum, invitationStatusEnum } from "./enums";
import { portalActors } from "./portal-actors";
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
    .references(() => portalActors.id),
  // Only the SHA-256 digest is stored. The secret appears only in the emailed link.
  token: varchar("token", { length: 255 }).notNull().unique(),
  purpose: varchar("purpose", { length: 20 })
    .$type<"staff" | "policyholder">()
    .notNull()
    .default("staff"),
  status: invitationStatusEnum("status").notNull().default("pending"),
  revokedAt: timestamp("revoked_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: uuid("accepted_by").references(() => portalActors.id),
  enrollmentName: text("enrollment_name"),
  enrollmentPhone: varchar("enrollment_phone", { length: 30 }),
  enrollmentPolicyType: varchar("enrollment_policy_type", { length: 20 }).$type<
    "motor" | "burglary"
  >(),
  enrollmentPolicyNumber: varchar("enrollment_policy_number", { length: 50 }),
  policyProfile: jsonb("policy_profile").$type<{
    insurerReference: string | null;
    coverageStart: string | null;
    coverageEnd: string | null;
    insuredAsset: string;
    coverageSummary: string;
    source: "manual" | "demo";
  }>(),
  deliveryState: varchar("delivery_state", { length: 20 })
    .$type<"pending" | "sandbox" | "sent" | "failed">()
    .notNull()
    .default("pending"),
  deliveryError: text("delivery_error"),
  lastSentAt: timestamp("last_sent_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
