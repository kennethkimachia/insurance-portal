import test from "node:test";
import assert from "node:assert/strict";
import { claimUpdateSchema, latestPublicClaimUpdate, updateIsOverdue, validateUpdateTiming, claimJourney } from "../lib/claim-communication";
import { claimAttention, compareQueueClaims } from "../lib/claim-queue-policy";
import { claimFieldStep, policyIncidentWarning } from "../lib/claim-form-guidance";
const now = new Date("2026-11-02T12:00:00Z");
const update = { kind: "delay" as const, visibility: "public" as const, title: "Survey report expected", message: "We have asked the assessor for the report and will follow up tomorrow.", nextAction: "Your claims agent will contact the assessor.", responsibleParty: "agent" as const, waitingReason: "The assessor is completing the inspection report.", nextUpdateAt: "2026-11-03T12:00:00+03:00", appointmentAt: "", appointmentLocation: "", contactDetails: "" };

test("public progress updates require next action, expected update, and explained delays", () => {
  assert.ok(claimUpdateSchema.safeParse(update).success);
  for (const changes of [{ nextUpdateAt: "" }, { nextAction: "" }, { waitingReason: "" }, { visibility: "everyone" }, { kind: "approved" }, { nextUpdateAt: "tomorrow" }, { appointmentLocation: "Office", appointmentAt: "" }])
    assert.equal(claimUpdateSchema.safeParse({ ...update, ...changes }).success, false);
  assert.ok(claimUpdateSchema.safeParse({ ...update, visibility: "internal", nextUpdateAt: "" }).success);
  assert.equal(validateUpdateTiming(update, now), null);
  assert.match(validateUpdateTiming({ ...update, nextUpdateAt: now.toISOString() }, now)!, /future/);
  assert.match(validateUpdateTiming({ ...update, appointmentAt: now.toISOString() }, now)!, /future/);
});

test("latest public summary never selects internal events or malformed metadata", () => {
  const events = [
    { type: "progress_update", visibility: "public", metadata: update, createdAt: "2026-11-01T09:00:00Z" },
    { type: "progress_update", visibility: "internal", metadata: { ...update, visibility: "internal", message: "Confidential" }, createdAt: "2026-11-02T09:00:00Z" },
    { type: "progress_update", visibility: "public", metadata: {}, createdAt: "2026-11-02T10:00:00Z" },
  ];
  assert.equal(latestPublicClaimUpdate(events)?.message, update.message);
  assert.equal(latestPublicClaimUpdate(events.slice(1)), null);
  assert.equal(updateIsOverdue("2026-11-01T12:00:00Z", "under_review", now), true);
  for (const status of ["settled", "rejected", "withdrawn"]) assert.equal(updateIsOverdue("2026-11-01T12:00:00Z", status, now), false);
  assert.equal(updateIsOverdue("invalid", "assigned", now), false);
});

test("queue attention prioritizes withdrawals, promised updates, received replies and evidence", () => {
  const base = { status: "under_review", createdAt: "2026-11-01T10:00:00Z" };
  const withdrawal = { ...base, withdrawalRequestedAt: base.createdAt };
  const reply = { ...base, respondedRequestCount: 1 };
  const document = { ...base, unreviewedDocumentCount: 1 };
  assert.equal(claimAttention({ ...base, nextUpdateAt: "2026-11-01T12:00:00Z" }, now).category, "followup");
  assert.ok(compareQueueClaims(withdrawal, reply, now) < 0);
  assert.ok(compareQueueClaims(reply, document, now) < 0);
  assert.equal(claimAttention({ ...withdrawal, status: "withdrawn" }, now).category, "closed");
  assert.equal(claimAttention({ ...base, status: "awaiting_information" }, now).category, "waiting");
});

test("claim journey keeps approval separate from settlement and handles terminated outcomes", () => {
  assert.equal(claimJourney("approved", true).find((s) => s.label === "Settlement recorded")?.state, "pending");
  assert.equal(claimJourney("settled", true).at(-1)?.state, "complete");
  for (const status of ["rejected", "withdrawn"]) assert.equal(claimJourney(status, true).at(-1)?.state, "not_applicable");
  assert.equal(claimJourney("under_review", true).find((s) => s.label === "Decision recorded")?.state, "pending");
});

test("form navigation handles nested fields and coverage warnings do not decide eligibility", () => {
  assert.equal(claimFieldStep("thirdParties.0.contactPhone"), 1);
  assert.equal(claimFieldStep("pendingEvidence"), 2);
  assert.equal(claimFieldStep("declarationAccepted"), 3);
  assert.equal(claimFieldStep("discoveryDate"), 0);
  const form = { incidentTiming: "exact", incidentDate: "2025-12-31", incidentRangeStart: "", incidentRangeEnd: "", discoveryDate: "2026-01-01" };
  const policy = { coverageStart: "2026-01-01", coverageEnd: "2026-12-31" };
  assert.match(policyIncidentWarning(form, policy)!, /outside/);
  assert.match(policyIncidentWarning({ ...form, incidentTiming: "unknown" }, policy)!, /discovery date alone/);
  assert.equal(policyIncidentWarning({ ...form, incidentDate: "2026-06-01" }, policy), null);
  assert.match(policyIncidentWarning({ ...form, incidentTiming: "approximate", incidentRangeStart: "2025-12-31", incidentRangeEnd: "2026-01-02" }, policy)!, /Part of/);
});

test("a lost-response progress update can replay only with the same author, claim and content", async () => {
  const { claimUpdateReplayMatches } = await import("../lib/claim-communication");
  const data = claimUpdateSchema.parse(update);
  const record = { claimId: "claim-a", actorId: "agent-a", type: "progress_update", visibility: "public", metadata: { ...data } };
  assert.equal(claimUpdateReplayMatches(record, "claim-a", "agent-a", data), true);
  assert.equal(claimUpdateReplayMatches(record, "claim-b", "agent-a", data), false);
  assert.equal(claimUpdateReplayMatches(record, "claim-a", "agent-b", data), false);
  assert.equal(claimUpdateReplayMatches(record, "claim-a", "agent-a", { ...data, message: "Changed message" }), false);
  assert.equal(claimUpdateReplayMatches({ ...record, visibility: "internal" }, "claim-a", "agent-a", data), false);
  assert.equal(claimUpdateSchema.safeParse({ ...data, nextUpdateAt: "2026-02-30T12:00:00+03:00" }).success, false);
});
