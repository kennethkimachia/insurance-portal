import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { claims } from "./claims";
import { portalActors } from "./portal-actors";

export const claimEvents = pgTable("claim_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  actorId: uuid("actor_id").references(() => portalActors.id),
  type: varchar("type", { length: 50 }).notNull(),
  visibility: varchar("visibility", { length: 20 }).notNull().default("public"),
  content: text("content").notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const evidenceRequests = pgTable("evidence_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => portalActors.id),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  message: text("message").notNull(),
  dueAt: timestamp("due_at"),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  response: text("response"),
  responseBy: uuid("response_by").references(() => portalActors.id),
  responseAt: timestamp("response_at"),
  resolvedBy: uuid("resolved_by").references(() => portalActors.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
