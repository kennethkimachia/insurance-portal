import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "head_agent",
  "agent",
  "user",
]);

export const policyTypeEnum = pgEnum("policy_type", [
  "motor",
  "burglary",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending",
  "assigned",
  "surveyor_dispatched",
  "under_review",
  "assessment_complete",
  "approved",
  "settled",
  "rejected",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
]);
