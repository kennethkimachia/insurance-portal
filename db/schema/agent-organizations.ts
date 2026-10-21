import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { portalActors } from "./portal-actors";
import { organizations } from "./organizations";

export const agentOrganizations = pgTable(
  "agent_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => portalActors.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("agent_org_unique").on(table.agentId, table.organizationId),
  ]
);
