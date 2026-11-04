import test from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { claims, claimProgressSteps, claimEvents, claimNotifications, claimAttachments, evidenceRequests } from "../db/schema";
import { workResultSchema, latestWorkResult } from "../lib/claim-casework";
import { canAccessClaim } from "../lib/claim-access-policy";
import { validateClaimReadiness, validateStatusTransition } from "../lib/claim-workflow";

test("work results require a real next action for follow-up and a source for assessed costs", () => {
  const result = { result: "completed", summary: "The review returned a written report." };
  assert.equal(workResultSchema.safeParse(result).success, true);
  assert.equal(workResultSchema.safeParse({ ...result, result: "follow_up" }).success, false);
  assert.equal(workResultSchema.safeParse({ ...result, assessedAmount: "45000" }).success, false);
  assert.equal(workResultSchema.safeParse({ ...result, assessedAmount: "45000", assessmentBasis: "Written assessment reference R-123" }).success, true);
  assert.equal(workResultSchema.safeParse({ ...result, result: "cancelled", assessedAmount: "45000", assessmentBasis: "Written assessment reference R-123" }).success, false);
  assert.equal(workResultSchema.safeParse({ ...result, assessedAmount: "-1", assessmentBasis: "Written assessment reference R-123" }).success, false);
  assert.equal(workResultSchema.safeParse({ ...result, result: "follow_up", followUpTitle: "Get the missing report", followUpAt: "2026-02-30T12:00:00+03:00" }).success, false);
  const readiness = { assessmentSummary: "The supporting evidence has been reviewed.", openEvidenceRequests: 0, unreviewedDocuments: 0, openWorkItems: 1 };
  for (const status of ["assessment_complete", "approved", "settled"] as const) assert.match(validateClaimReadiness(status, readiness)!, /outstanding work/);
  assert.equal(validateClaimReadiness("rejected", readiness), null);
  for (const status of ["pending", "assigned", "awaiting_information", "surveyor_dispatched", "under_review", "assessment_complete"]) {
    assert.equal(validateStatusTransition(status, "rejected", "head_agent", "Written grounds for the claim decision"), null);
    assert.ok(validateStatusTransition(status, "rejected", "agent", "Written grounds for the claim decision"));
  }
});

const requireModule = createRequire(__filename);
type Row = Record<string, unknown>;
const dialect = new PgDialect();

test("case work connects an activity, retry-safe result, follow-up, sourced cost and final manager rejection", async () => {
  const originals = new Map<string, NodeJS.Module | undefined>();
  const replace = (path: string, exports: unknown) => {
    const id = requireModule.resolve(path); originals.set(id, requireModule.cache[id]);
    const stub = new Module(id); stub.exports = exports; stub.loaded = true; requireModule.cache[id] = stub;
  };
  const claimId = crypto.randomUUID(), actorId = crypto.randomUUID(), organizationId = crypto.randomUUID();
  let role: "agent" | "head_agent" | "user" = "agent";
  let member = true, requestCount = 0, documentCount = 0, failEvent = false;
  let claim: Row = { id: claimId, organizationId, policyholderId: "owner", assignedAgentId: actorId, status: "assigned", version: 1, claimNumber: "CLAIM-TEST", assessmentSummary: null, estimatedLossAmount: null };
  let steps: Row[] = [], events: Row[] = [], notifications: Row[] = [];
  const filter = (table: unknown, condition: SQL) => {
    const query = dialect.sqlToQuery(condition);
    if (table === claimEvents) return events.filter((event) => event.id === query.params[0]);
    if (table === claimProgressSteps) {
      if (query.sql.includes('"is_completed"')) return steps.filter((step) => !step.isSystem && !step.isCompleted);
      if (query.params[0] === claimId) return steps;
      return steps.filter((step) => step.id === query.params[0]);
    }
    if (table === claimAttachments) return [];
    return [claim];
  };
  const database = {
    select: (selection?: Row) => ({ from: (table: unknown) => ({ where: (condition: SQL) => {
      let result: Row[];
      if (selection && "count" in selection) result = [{ count: table === evidenceRequests ? requestCount : table === claimAttachments ? documentCount : steps.filter((step) => !step.isSystem && !step.isCompleted).length }];
      else if (selection && "next" in selection) result = [{ next: steps.length + 1 }];
      else result = filter(table, condition);
      const value = Object.assign(Promise.resolve(result), { limit: async () => result, for: () => ({ limit: async () => result }) });
      return value;
    } }) }),
    insert: (table: unknown) => ({ values: (input: Row) => {
      if (failEvent && table === claimEvents) throw new Error("Synthetic event failure");
      const row = { id: crypto.randomUUID(), createdAt: new Date(), isCompleted: false, completedAt: null, completedBy: null, ...input };
      if (table === claimProgressSteps) steps.push(row);
      else if (table === claimEvents) events.push(row);
      else if (table === claimNotifications) notifications.push(row);
      else assert.fail("Unexpected insert");
      return Object.assign(Promise.resolve(), { returning: async () => [row] });
    } }),
    update: (table: unknown) => ({ set: (values: Row) => ({ where: (condition: SQL) => {
      if (table === evidenceRequests) requestCount = 0;
      const rows = table === evidenceRequests ? [] : table === claims ? [claim] : filter(table, condition);
      for (const row of rows) for (const [key, value] of Object.entries(values)) row[key] = key === "version" ? Number(row.version) + 1 : value;
      return Object.assign(Promise.resolve(), { returning: async () => rows });
    } }) }),
  };
  const paths = ["../app/actions/agent/progress-steps", "../app/actions/agent/manage-claims", "../app/actions/agent/assessment"];
  for (const path of paths) { const id = requireModule.resolve(path); originals.set(id, requireModule.cache[id]); delete requireModule.cache[id]; }
  try {
    replace("../db", { db: { ...database, transaction: async (run: (tx: typeof database) => Promise<unknown>) => {
      const before = structuredClone({ claim, steps, events, notifications });
      try { return await run(database); } catch (error) { ({ claim, steps, events, notifications } = before); throw error; }
    } } });
    replace("../lib/session", { requireSession: async () => ({ id: actorId, role, emailVerified: true }) });
    replace("../lib/claim-access", {
      requireClaimAccess: async () => {
        if (!canAccessClaim(role, actorId, claim as never, member, "manage")) throw new Error("Claim not found or access denied");
        return { ...claim };
      },
      lockClaimForMutation: async () => {
        if (!canAccessClaim(role, actorId, claim as never, member, "manage")) throw new Error("Claim not found or access denied");
        return { ...claim };
      },
    });
    replace("../lib/clerk-directory", {});
    replace("../lib/organization-access", {});
    replace("next/cache", { revalidatePath: () => {} });
    const { addProgressStep, recordProgressResult } = requireModule(paths[0]) as typeof import("../app/actions/agent/progress-steps");
    const { updateClaimStatus } = requireModule(paths[1]) as typeof import("../app/actions/agent/manage-claims");
    const { recordClaimAssessment } = requireModule(paths[2]) as typeof import("../app/actions/agent/assessment");
    const expected = new Date(Date.now() + 86400000).toISOString().replace(/\.\d{3}Z$/, "Z");
    const activityId = crypto.randomUUID();
    const plan = { responsibleParty: "agent", followUpAt: expected };
    const activity = await addProgressStep(claimId, "Review the submitted evidence", "The report was received and the evidence is being reviewed.", plan, activityId);
    assert.equal(activity.success, true);
    assert.equal(steps.length, 1); assert.equal(events.length, 1); assert.equal(notifications.length, 1);
    assert.equal((await addProgressStep(claimId, "Review the submitted evidence", "The report was received and the evidence is being reviewed.", plan, activityId)).success, true);
    assert.equal(steps.length, 1); assert.equal(notifications.length, 1);
    const stepId = String(steps[0].id);
    const input = { result: "follow_up", summary: "The first review identified a missing report.", followUpTitle: "Obtain and review the report", followUpAt: expected, responsibleParty: "agent" };
    const resultId = crypto.randomUUID();
    failEvent = true;
    assert.equal((await recordProgressResult(stepId, input, resultId)).success, false);
    assert.equal(steps.length, 1); assert.equal(steps[0].isCompleted, false); assert.equal(notifications.length, 1);
    failEvent = false;
    assert.equal((await recordClaimAssessment(claimId, { summary: "The supporting records have been reviewed.", completeReview: true })).success, false);
    assert.equal(claim.status, "assigned");
    assert.equal((await recordProgressResult(stepId, input, resultId)).success, true);
    assert.equal(steps.length, 2); assert.equal(steps[0].isCompleted, true); assert.equal(steps[1].isCompleted, false);
    assert.equal(events.at(-1)!.metadata && (events.at(-1)!.metadata as Row).followUpStepId, steps[1].id);
    assert.equal((await recordProgressResult(stepId, input, resultId)).success, true);
    assert.equal(steps.length, 2); assert.equal(notifications.length, 2);
    assert.equal((await recordProgressResult(stepId, { ...input, summary: "An altered result should never replay." }, resultId)).success, false);
    member = false;
    assert.equal((await recordProgressResult(String(steps[1].id), { result: "completed", summary: "The report is now available." }, crypto.randomUUID())).success, false);
    member = true;
    assert.equal((await recordProgressResult(String(steps[1].id), { result: "completed", summary: "An unrelated document cannot establish this cost.", assessedAmount: "20000", assessmentBasis: "Assessment report from another claim", assessmentAttachmentId: crypto.randomUUID() }, crypto.randomUUID())).success, false);
    assert.equal(claim.estimatedLossAmount, null);
    assert.equal((await recordProgressResult(String(steps[1].id), { result: "recommend_rejection", summary: "The report recommends declining the claim on recorded evidence.", assessedAmount: "52000.50", assessmentBasis: "Written report reference REPORT-123" }, crypto.randomUUID())).success, true);
    assert.equal(claim.estimatedLossAmount, "52000.50"); assert.equal(claim.status, "assigned");
    assert.equal((await recordClaimAssessment(claimId, { summary: "The report and supporting evidence have been reviewed.", completeReview: true })).success, true);
    assert.equal(claim.status, "assessment_complete"); assert.equal(claim.estimatedLossAmount, "52000.50");
    await addProgressStep(claimId, "Another outstanding action", "An additional report has been requested.");
    const decision = { source: "manual" as const, assessmentSummary: "Internal findings supporting the recorded manager decision." };
    assert.equal((await updateClaimStatus(claimId, "rejected", "The supporting report does not establish an insured loss.", decision)).success, false);
    role = "head_agent";
    requestCount = 1; documentCount = 1;
    assert.equal((await updateClaimStatus(claimId, "rejected", "The supporting report does not establish an insured loss.", decision)).success, true);
    assert.equal(claim.status, "rejected"); assert.equal(requestCount, 0); assert.ok(steps.every((step) => step.isCompleted));
    const cancelled = events.find((event) => event.type === "task_result" && (event.metadata as Row).result === "cancelled")!;
    const rendered = latestWorkResult(String((cancelled.metadata as Row).stepId), events.map((event) => ({ ...event, createdAt: (event.createdAt as Date).toISOString() })) as never);
    assert.equal(rendered?.result, "cancelled");
    assert.ok(events.some((event) => event.type === "assessment_recorded" && event.visibility === "internal" && event.content === decision.assessmentSummary));
    assert.ok(events.every((event) => event.visibility === "internal" || !String(event.content).includes(decision.assessmentSummary)));
    assert.equal((await recordProgressResult(String(steps[2].id), { result: "completed", summary: "Cannot update work on a closed claim." }, crypto.randomUUID())).success, false);
    assert.equal((await addProgressStep(claimId, "Cannot add work", "The claim is already closed.")).success, false);
    claim.status = "assigned"; claim.assessmentSummary = null;
    assert.equal((await updateClaimStatus(claimId, "rejected", "A direct rejection with recorded grounds.", decision)).success, true);
    assert.equal(claim.status, "rejected");
    assert.equal((events.at(-1)!.metadata as Row).from, "assigned");
  } finally {
    for (const [id, original] of originals) { if (original) requireModule.cache[id] = original; else delete requireModule.cache[id]; }
  }
});
