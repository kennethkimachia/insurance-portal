import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { demoWorkspace } from "../lib/prototype-fixtures";
import { blankMotorClaim, blankBurglaryClaim } from "../lib/schemas/claim-forms";
import { claimReportSections } from "../lib/claim-report";
import { exportDocuments, exportFilename, renderClaimExport } from "../lib/claim-export-report";
import { assertPackageSize, createClaimPackage, verifiedDocumentBytes } from "../lib/claim-export-package";

const time = "2026-11-04T10:30:00.000Z";
const bytes = new TextEncoder().encode("Original file bytes — no transcoding");
async function* source() { yield bytes.slice(0, 5); yield bytes.slice(5); }

function fixture() {
  const data = demoWorkspace("agent", "burglary");
  data.submittedReport = { ...blankBurglaryClaim(), description: "<script>alert('claim')</script>\nOriginal account.", lossItems: [{ itemKey: "item-one", description: "Laptop ABC-001", quantity: 2, replacementValue: "80000.50" }], extraAnswer: { witnessName: "Grace Njeri" } };
  data.documents = [
    { ...data.documents[0], id: "doc-one", name: "invoice #1 (東京).pdf", size: bytes.length, scanState: "clean", reviewStatus: "accepted", lossItemId: "item-one" },
    { ...data.documents[0], id: "doc-two", name: "invoice #1 (東京).pdf", size: bytes.length, scanState: "pending", reviewStatus: "needs_replacement" },
    { ...data.documents[0], id: "doc-blocked", name: "blocked.pdf", scanState: "rejected" },
    { ...data.documents[0], id: "doc-missing", name: "missing.pdf", uploadState: "failed" },
    { ...data.documents[0], id: "doc-quarantined", name: "quarantined.pdf", scanState: "quarantined" },
  ];
  data.claim.outcomeReason = "Decision made by the external claims committee.";
  data.claim.outcomeSource = "manual";
  data.claim.settlementAmount = "12345.67";
  data.claim.settlementReference = "PAYMENT-REF-123";
  data.claim.carrierReference = "INTERNAL-SYSTEM-456";
  data.events.push({ ...data.events[0], id: "internal-event", visibility: "internal", content: "PRIVATE-EVENT-FINDING", type: "assessment_recorded" });
  data.notes.push({ ...data.notes[0], id: "private-note", content: "PRIVATE-NOTE-FINDING" });
  data.events.push({ ...data.events[0], id: "amendment", type: "amendment", content: "Correction: incident discovered at 09:30." });
  return data;
}

test("readable report preserves both form types, free text, nested people and monetary values", () => {
  for (const form of [blankMotorClaim(), blankBurglaryClaim()]) {
    const data = fixture();
    data.submittedReport = form;
    const report = renderClaimExport(data, exportDocuments(data.documents), time);
    for (const group of claimReportSections(form)) {
      for (const entry of group.fields) assert.ok(report.includes(entry.label.replaceAll("&", "&amp;")), entry.key);
    }
  }
  const data = fixture();
  const report = renderClaimExport(data, exportDocuments(data.documents), time);
  for (const value of ["Grace Njeri", "Laptop ABC-001", "80,000.50", "PRIVATE-NOTE-FINDING", "PRIVATE-EVENT-FINDING", "09:30", "PAYMENT-REF-123", "INTERNAL-SYSTEM-456", "12,345.67", "D001", "D002", "Item 1: Laptop ABC-001", "EAT", "Record version 3"])
    assert.ok(report.includes(value), value);
  assert.match(report, /&lt;script&gt;alert\(&#39;claim&#39;\)&lt;\/script&gt;\nOriginal account\./);
  assert.doesNotMatch(report, /<script|\[object Object\]|item-one|clientUploadId|storageKey|https?:\/\//);
  assert.match(report, /Externally made decision recorded manually/);
  assert.match(report, /Print \/ Save as PDF/);
  assert.match(report, /Internal review copy/);
  assert.match(report, /default-src 'none'/);
});

test("policyholder report excludes internal notes, events and assessment even if passed staff data", () => {
  const data = fixture();
  data.role = "user";
  data.claim.assessmentSummary = "PRIVATE-ASSESSMENT";
  const report = renderClaimExport(data, exportDocuments(data.documents), time);
  assert.doesNotMatch(report, /PRIVATE-|Internal review findings/);
  assert.match(report, /Policyholder copy/);
  assert.match(report, /Correction: incident discovered/);
});

test("legacy or missing forms are explicitly described and unuploaded selections are not lost", () => {
  const data = fixture();
  data.reportSource = "legacy";
  assert.match(renderClaimExport(data, [], time), /Recovered from the stored claim details/);
  data.reportSource = "saved";
  assert.match(renderClaimExport(data, [], time), /Saved answers/);
  data.submittedReport = { pendingEvidence: [{ clientUploadId: "not-uploaded", name: "expected receipt.pdf", category: "proof_of_ownership" }] };
  const report = renderClaimExport(data, [], time);
  assert.match(report, /expected receipt.pdf/);
  assert.match(report, /Original not included; request an upload/);
  data.submittedReport = null;
  data.reportSource = "unavailable";
  assert.match(renderClaimExport(data, [], time), /No saved form answers were found/);
});

test("package names are unique, portable and traversal safe; incomplete and unsafe files stay indexed", () => {
  assert.equal(exportFilename('../../bad\\name:"\n.pdf'), "__.._bad_name___.pdf");
  const data = fixture();
  const docs = exportDocuments(data.documents);
  assert.equal(new Set(docs.map((doc) => doc.path).filter(Boolean)).size, 2);
  assert.ok(docs[0].path?.startsWith("documents/D001-"));
  for (const doc of docs.slice(2)) assert.equal(doc.path, null);
  const report = renderClaimExport(data, docs, time);
  assert.match(report, /2 file\(s\) included; 3 recorded file\(s\) excluded/);
  assert.match(report, /File blocked or quarantined/);
  assert.match(report, /Upload incomplete/);
  assert.match(report, /Awaiting inspection/);
  assert.match(report, /Replacement requested/);
  const links = [...report.matchAll(/href="(documents\/[^\"]+)"/g)].map((match) => decodeURIComponent(match[1]));
  assert.deepEqual(links, docs.filter((doc) => doc.path).map((doc) => doc.path));
});

test("ZIP contains offline report and byte-identical originals, excluding only explicitly unavailable files", async () => {
  const data = fixture();
  const read: string[] = [];
  const stream = createClaimPackage(data, async function* (doc) { read.push(doc.id); yield* source(); }, time);
  const archive = unzipSync(new Uint8Array(await new Response(stream).arrayBuffer()));
  assert.deepEqual(read, ["doc-one", "doc-two"]);
  const paths = exportDocuments(data.documents).flatMap((doc) => doc.path ? [doc.path] : []);
  assert.deepEqual(Object.keys(archive), ["report.html", "README.txt", ...paths]);
  for (const path of paths) assert.deepEqual(archive[path], bytes);
  assert.equal(strFromU8(archive["report.html"]), renderClaimExport(data, exportDocuments(data.documents), time));
  assert.match(strFromU8(archive["README.txt"]), /CONFIDENTIAL/);
  assert.match(strFromU8(archive["README.txt"]), /blocked.pdf — EXCLUDED/);
});

test("claims without documents still export a complete readable report", async () => {
  const data = fixture();
  data.documents = [];
  const archive = unzipSync(new Uint8Array(await new Response(createClaimPackage(data, () => { throw new Error("Should not read storage"); }, time)).arrayBuffer()));
  assert.deepEqual(Object.keys(archive), ["report.html", "README.txt"]);
  assert.match(strFromU8(archive["report.html"]), /No supporting documents recorded/);
});

test("failed storage or authorization interrupts the export instead of returning a complete partial ZIP", async () => {
  await assert.rejects(new Response(createClaimPackage(fixture(), async function* () { throw new Error("Access revoked or file missing"); })).arrayBuffer(), /Access revoked or file missing/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(new Response(createClaimPackage(fixture(), source, time, abort.signal)).arrayBuffer(), /Export cancelled/);
});

test("original bytes are checked for truncation, wrong size and SHA-256 corruption", async () => {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const consume = async (size: number | null, expectedHash: string | null) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of verifiedDocumentBytes(source(), size, expectedHash)) chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  assert.deepEqual(await consume(bytes.length, hash), Buffer.from(bytes));
  assert.deepEqual(await consume(null, null), Buffer.from(bytes));
  await assert.rejects(consume(bytes.length + 1, hash), /incomplete/);
  await assert.rejects(consume(bytes.length - 1, hash), /size changed/);
  await assert.rejects(consume(bytes.length, "0".repeat(64)), /verification failed/);
  const data = fixture();
  data.documents[0].size = 0xffffffff;
  assert.throws(() => assertPackageSize(data.documents), /supported ZIP/);
});

test("a cancelled package aborts its active file source", async () => {
  const data = fixture();
  let signal: AbortSignal | null = null;
  const reader = createClaimPackage(data, async function* (_doc, activeSignal) {
    signal = activeSignal;
    yield bytes;
  }).getReader();
  while (!signal) await reader.read();
  await reader.cancel();
  assert.equal((signal as AbortSignal).aborted, true);
});
