import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { portalActors } from "./portal-actors";
import { claims } from "./claims";

export const claimAttachments = pgTable(
  "claim_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    contentSha256: varchar("content_sha256", { length: 64 }),
    uploadState: varchar("upload_state", { length: 20 })
      .notNull()
      .default("ready"),
    uploadError: text("upload_error"),
    sizeBytes: integer("size_bytes"),
    category: varchar("category", { length: 50 }).notNull().default("other"),
    lossItemId: varchar("loss_item_id", { length: 100 }),
    clientUploadId: uuid("client_upload_id"),
    scanState: varchar("scan_state", { length: 20 })
      .notNull()
      .default("pending"),
    reviewStatus: varchar("review_status", { length: 20 })
      .notNull()
      .default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => portalActors.id),
    reviewedAt: timestamp("reviewed_at"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => portalActors.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("claim_upload_unique").on(table.claimId, table.clientUploadId),
  ],
);
