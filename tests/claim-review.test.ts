import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmittedClaimReport } from "../components/claims/submitted-claim-report";
import { claimReportSections, reportValue } from "../lib/claim-report";
import { blankMotorClaim, blankBurglaryClaim } from "../lib/schemas/claim-forms";
import { canInspectEvidence, evidencePreviewType, evidenceReviewLabel, evidenceSize, isInterruptedUpload } from "../lib/evidence-presentation";

test("submitted forms retain every answer and group driver and loss inventory fields", () => {
  for (const report of [blankMotorClaim(), blankBurglaryClaim()]) {
    const visible = claimReportSections(report).flatMap((section) => section.fields.map((field) => field.key));
    assert.deepEqual(new Set(visible), new Set(Object.keys(report).filter((field) => field !== "pendingEvidence")));
    assert.equal(visible.length, new Set(visible).size);
  }
  assert.equal(claimReportSections({ driverFullName: "Amina Wanjiku" })[0].title, "Driver");
  assert.equal(claimReportSections({ unusualLegacyAnswer: "Preserved" })[0].fields[0].value, "Preserved");
});

test("report renders named people, nested details, inventory and unmodified narratives without a collapsed disclosure", () => {
  const html = renderToStaticMarkup(createElement(SubmittedClaimReport, { source: "original", report: {
    ...blankMotorClaim(),
    driverFullName: "Amina Wanjiku",
    description: "Hit near gate_A.\nVehicle was stationary.",
    thirdParties: [{ name: "James Otieno", contactPhone: "+254700123456", injuryDetails: "Left arm" }],
    extraDetails: { namedWitness: "Grace Njeri", confirmed: false },
    lossItems: [{ itemKey: "private-internal-id", description: "Laptop", quantity: 2, originalCost: "45000.50" }],
  } }));
  for (const value of ["Amina Wanjiku", "James Otieno", "+254700123456", "Grace Njeri", "gate_A", "Laptop", "45,000.50", "Driver’s full name"])
    assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /\[object Object\]|<details|private-internal-id|pendingEvidence/);
  assert.match(html, /Original answers as submitted/);
  const legacy = renderToStaticMarkup(createElement(SubmittedClaimReport, { source: "legacy", report: { driverFullName: "Amina" } }));
  assert.match(legacy, /Recovered from the stored claim details/);
  assert.equal(reportValue("injuries", "unknown"), "Unknown");
  assert.equal(reportValue("privacyAccepted", false), "No");
  assert.equal(reportValue("description", "a_b"), "a_b");
  assert.equal(reportValue("currentMileage", 0), "0");
});

test("received evidence is viewable before inspection, with passive file types and blocked states enforced", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp", "application/pdf", "video/mp4", "video/quicktime", "video/webm"])
    assert.equal(evidencePreviewType(type), type);
  for (const type of ["text/html", "image/svg+xml", "text/csv", "application/javascript", "application/octet-stream"])
    assert.equal(evidencePreviewType(type), null);
  const doc = { uploadState: "ready", scanState: "pending" };
  assert.equal(canInspectEvidence(doc), true);
  assert.equal(canInspectEvidence({ ...doc, scanState: "clean" }), true);
  assert.equal(canInspectEvidence({ ...doc, scanState: "rejected" }), false);
  assert.equal(canInspectEvidence({ ...doc, uploadState: "failed", scanState: "clean" }), false);
  assert.equal(canInspectEvidence({ ...doc, uploadState: "uploading" }), false);
  assert.equal(canInspectEvidence({ ...doc, scanState: "quarantined" }), false);
  assert.equal(canInspectEvidence({}), false);
});

test("interrupted uploads and small evidence files have accurate labels", () => {
  const now = Date.now();
  assert.equal(isInterruptedUpload({ uploadState: "uploading", updatedAt: new Date(now - 300_001).toISOString() }, now), true);
  assert.equal(isInterruptedUpload({ uploadState: "uploading", updatedAt: new Date(now - 299_999).toISOString() }, now), false);
  assert.equal(isInterruptedUpload({ uploadState: "ready", updatedAt: new Date(0).toISOString() }, now), false);
  assert.equal(evidenceReviewLabel({ uploadState: "uploading", updatedAt: new Date(0).toISOString() }), "Upload interrupted");
  assert.equal(evidenceReviewLabel({ scanState: "rejected", reviewStatus: "waived" }), "Waived");
  assert.equal(evidenceReviewLabel({ scanState: "rejected", reviewStatus: "needs_replacement" }), "Replacement requested");
  assert.equal(evidenceSize(1234), "1 KB");
});
