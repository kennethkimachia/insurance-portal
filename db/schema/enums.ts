import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "head_agent",
  "agent",
  "user",
]);

export const policyTypeEnum = pgEnum("policy_type", ["motor", "burglary"]);

export const claimStatusEnum = pgEnum("claim_status", [
  "draft",
  "pending",
  "assigned",
  "surveyor_dispatched",
  "under_review",
  "assessment_complete",
  "approved",
  "settled",
  "rejected",
  "awaiting_information",
  "withdrawn",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
]);
