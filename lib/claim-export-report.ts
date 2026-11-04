import type { getClaimWorkspace } from "@/app/actions/user/my-claims";
import { claimReportSections, reportEntries, reportFieldLabel, reportValue } from "./claim-report";
import { canInspectEvidence, evidenceSize } from "./evidence-presentation";
import { statusLabels, isClaimStatus } from "./claim-workflow";
import { WORK_RESULTS } from "./claim-casework";
import { RESPONSIBLE_PARTIES, UPDATE_KINDS } from "./claim-communication";

export type ClaimExportData = Awaited<ReturnType<typeof getClaimWorkspace>>;
export type ExportDocument = ClaimExportData["documents"][number] & {
  reference: string;
  path: string | null;
  exclusion: string | null;
};

/** Portable names, including for older records that predate upload validation. */
export function exportFilename(value: string) {
  return value.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_")
    .replace(/^\.+/, "_").replace(/[. ]+$/, "").slice(0, 180) || "document";
}

export function exportDocuments(documents: ClaimExportData["documents"]): ExportDocument[] {
  return documents.map((doc, index) => {
    const reference = `D${String(index + 1).padStart(3, "0")}`;
    const exclusion = doc.uploadState !== "ready" ? "Upload incomplete; original file is not available."
      : !canInspectEvidence(doc) ? "File blocked or quarantined; original file cannot be exported." : null;
    return { ...doc, reference, exclusion, path: exclusion ? null : `documents/${reference}-${exportFilename(doc.name)}` };
  });
}

function escape(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
function readable(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}
function instant(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.toLocaleString("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" })} EAT` : value;
}
function amount(value: string | null) {
  return value == null || value === "" ? "Not recorded" : `KES ${reportValue("originalCost", value)}`;
}
function text(value: unknown) {
  return `<span class="answer">${escape(value == null || value === "" ? "Not provided" : value)}</span>`;
}
function field(label: string, value: unknown) {
  return `<div class="field"><dt>${escape(label)}</dt><dd>${text(value)}</dd></div>`;
}
function fields(entries: [string, unknown][]) {
  return `<dl class="fields">${entries.map(([label, value]) => field(label, value)).join("")}</dl>`;
}
function answer(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.length
    ? `<ol class="answers">${value.map((entry, index) => `<li><h4>${key === "thirdParties" ? "Third party" : "Item"} ${index + 1}</h4>${answer(key, entry)}</li>`).join("")}</ol>`
    : text("None reported at submission");
  if (value && typeof value === "object") return `<dl class="fields nested">${reportEntries(value as Record<string, unknown>).map(([name, entry]) => `<div class="field"><dt>${escape(reportFieldLabel(name))}</dt><dd>${answer(name, entry)}</dd></div>`).join("")}</dl>`;
  return text(reportValue(key, value));
}
function section(id: string, title: string, content: string) {
  return `<section id="${id}"><h2>${escape(title)}</h2>${content}</section>`;
}
const sourceDescriptions = {
  original: "Original answers as submitted. Subsequent amendments are listed separately in the case history.",
  saved: "Saved answers. An original submission snapshot was not preserved for this claim.",
  legacy: "Recovered from the stored claim details. An original submission snapshot was not preserved for this older claim.",
  unavailable: "No saved form answers were found. Request the original claim form before completing review.",
};
const reviewLabels: Record<string, string> = { pending: "Awaiting inspection", accepted: "Accepted", waived: "Waived", needs_replacement: "Replacement requested" };
const scanLabels: Record<string, string> = { pending: "Received; file screening pending", clean: "Marked clean in portal", rejected: "Blocked", quarantined: "Quarantined" };
const handoffLabels: Record<string, string> = { not_sent: "Not sent", manual: "Manually sent / recorded", simulated: "Simulation" };
const outcomeLabels: Record<string, string> = { manual: "Externally made decision recorded manually", simulated: "Simulation" };
const metadataFields = [ "nextAction", "responsibleParty", "waitingReason", "nextUpdateAt", "appointmentAt", "appointmentLocation", "contactDetails", "result", "summary", "followUpTitle", "followUpAt", "assessedAmount", "assessmentBasis", "reason", "source", "from", "to", "closedByDecision", "description", "expectedAt"];

/** HTML has no remote assets, scripts, storage URLs or dependency on a portal login. */
export function renderClaimExport(data: ClaimExportData, documents: ExportDocument[], exportedAt: string) {
  const { claim } = data;
  const staff = data.role !== "user";
  // Defense in depth: policyholder exports never include internal correspondence.
  const events = data.events.filter((event) => staff || event.visibility === "public");
  const notes = data.notes.filter((note) => staff || note.visibility === "public");
  const status = isClaimStatus(claim.status) ? statusLabels[claim.status] : readable(claim.status);
  const included = documents.filter((doc) => doc.path);
  const report = data.submittedReport;
  const lossItems = Array.isArray(report?.lossItems) ? report.lossItems : [];
  const lossItemName = (id: string | null) => {
    if (!id) return "Not linked to an individual item";
    const index = lossItems.findIndex((item) => item && typeof item === "object" && (item.itemKey === id || item.id === id));
    return index < 0 ? "Linked inventory item unavailable in saved form" : `Item ${index + 1}: ${lossItems[index].description || "Description not provided"}`;
  };
  const metadata = (record: Record<string, unknown>) => `<dl class="fields">${metadataFields.filter((key) => record[key] !== undefined && record[key] !== "").map((key) => {
    const raw = record[key];
    let value: unknown = raw;
    if (key.endsWith("At")) value = instant(String(raw));
    else if (key === "responsibleParty") value = RESPONSIBLE_PARTIES[raw as keyof typeof RESPONSIBLE_PARTIES] ?? readable(String(raw));
    else if (key === "result") value = WORK_RESULTS[raw as keyof typeof WORK_RESULTS] ?? readable(String(raw));
    else if (["from", "to", "closedByDecision"].includes(key) && isClaimStatus(String(raw))) value = statusLabels[raw as keyof typeof statusLabels];
    else if (key === "source") value = outcomeLabels[String(raw)] ?? readable(String(raw));
    else if (key === "assessedAmount") value = amount(String(raw));
    return field(reportFieldLabel(key), value);
  }).join("")}${typeof record.assessmentAttachmentId === "string" && record.assessmentAttachmentId ? field("Assessment document", documents.find((doc) => doc.id === record.assessmentAttachmentId)?.reference ?? "Document unavailable") : ""}</dl>`;

  const overview = section("overview", "1. Claim overview", fields([
    ["Claim reference", claim.claimNumber], ["Insurer / organization", claim.organizationName],
    ["Claim type", claim.policyType === "motor" ? "Motor" : "Burglary"], ["Current status", status],
    ["Submitted", instant(claim.submittedAt)], ["Last updated", instant(claim.updatedAt)],
    ["Policyholder", claim.policyholderName], ["Policyholder email", claim.policyholderEmail],
    ["Current contact telephone", claim.contactPhone], ["Portal agent", claim.agentName || "Unassigned"],
    ["Agent email", claim.agentEmail], ["Report exported", instant(exportedAt)],
    ["Claim record version", claim.version], ["Form version", claim.formVersion],
    ["Documents in package", `${included.length} of ${documents.length} recorded files`],
    ["Open information requests", data.requests.filter((request) => request.status !== "resolved").length],
  ]) + `<p class="note">This is a snapshot of the claim record at export. The portal agent communicates progress and records decisions; decision authority may sit with a team outside the portal. Recommendations, recorded decisions and settlement records are shown separately below.</p>`);

  const policy = section("policy", "2. Policy context at submission", `<p class="note">${claim.policySnapshot ? "Preserved policy details at submission. These details do not independently confirm cover for this incident." : "No policy snapshot was preserved. The current policy reference is shown below."}</p>${fields([["Policy number", claim.policyNumber]])}${claim.policySnapshot ? answer("policy", Object.fromEntries(Object.entries(claim.policySnapshot).filter(([key]) => !["id", "userId", "organizationId", "createdAt", "version"].includes(key)))) : ""}`);

  const form = section("form", "3. Submitted claim form", `<p class="note">${escape(sourceDescriptions[data.reportSource])}</p>${report ? claimReportSections(report).map((group) => `<h3>${escape(group.title)}</h3><dl class="fields">${group.fields.map(({ key, label, value }) => `<div class="field ${typeof value === "object" || ["description", "damageSummary", "witnesses", "entryMethod", "premisesDamage"].includes(key) ? "wide" : ""}"><dt>${escape(label)}</dt><dd>${answer(key, value)}</dd></div>`).join("")}</dl>`).join("") : ""}`);

  const decision = section("decision", "4. Review, recorded decision and settlement", `${staff ? `<h3>Internal review findings</h3>${fields([["Review findings", claim.assessmentSummary], ["Review recorded", instant(claim.assessedAt)], ["Recorded assessed cost / quotation", amount(claim.estimatedLossAmount)]])}<p class="note">Assessed costs and recommendations are review information. Their source and related documents are recorded in case history where available.</p>` : ""}<h3>Recorded decision</h3>${fields([["Current claim stage", status], ["Decision explanation", claim.outcomeReason || "No decision explanation recorded"], ["Decision source", claim.outcomeSource ? outcomeLabels[claim.outcomeSource] ?? readable(claim.outcomeSource) : "No source recorded"]])}<h3>Settlement record</h3>${fields([["Settlement amount", amount(claim.settlementAmount)], ["Settlement reference", claim.settlementReference], ["Settlement recorded", instant(claim.settlementRecordedAt)]])}<p class="note">Approval does not establish that payment has been sent. Settlement fields describe the recorded settlement and its external reference.</p><h3>External handoff and withdrawal</h3>${fields([["Handoff status", handoffLabels[claim.carrierHandoffState] ?? readable(claim.carrierHandoffState)], ["External system / carrier reference", claim.carrierReference], ["Withdrawal requested", instant(claim.withdrawalRequestedAt)], ["Withdrawal reason", claim.withdrawalReason]])}`);

  const expected = Array.isArray(report?.pendingEvidence) ? report.pendingEvidence.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").filter((item) => !documents.some((doc) => doc.clientUploadId === item.clientUploadId)) : [];
  const evidence = section("evidence", "5. Supporting documents", `<p class="note">Extract the complete ZIP before opening this report. The links below open original files in the accompanying documents folder without a portal account. Keep that folder with this report when forwarding it. Print / Save as PDF includes the report and document index; send the ZIP to include the original files.</p><p><strong>${included.length} file(s) included; ${documents.length - included.length} recorded file(s) excluded; ${expected.length} selected file(s) have no upload record.</strong></p>${documents.length ? documents.map((doc) => `<article class="document"><h3>${escape(doc.reference)} · ${escape(doc.name)}</h3>${fields([["Evidence category", readable(doc.category)], ["Original filename", doc.name], ["File type", doc.type], ["File size", evidenceSize(doc.size)], ["Uploaded", instant(doc.uploadedAt)], ["Upload state", readable(doc.uploadState)], ["File screening state", scanLabels[doc.scanState] ?? readable(doc.scanState)], ["Inspection status", reviewLabels[doc.reviewStatus] ?? readable(doc.reviewStatus)], ["Inspection note", doc.reviewNote], ["Loss inventory link", lossItemName(doc.lossItemId)]])}${doc.path ? `<p><a href="${escape(doc.path.split("/").map(encodeURIComponent).join("/"))}">Open ${escape(doc.reference)} original file</a></p>` : `<p class="warning">Excluded: ${escape(doc.exclusion)}</p>`}</article>`).join("") : "<p>No supporting documents recorded.</p>"}${expected.length ? `<h3>Selected at submission but no upload record found</h3><ul>${expected.map((item) => `<li>${escape(item.name)} · ${escape(readable(String(item.category || "other")))} · Original not included; request an upload.</li>`).join("")}</ul>` : ""}`);

  const requests = section("requests", "6. Information requests and responses", data.requests.length ? data.requests.map((request) => `<article><h3>${escape(request.title)}</h3>${fields([["Category", readable(request.category)], ["Status", readable(request.status)], ["Requested", instant(request.createdAt)], ["Due", instant(request.dueAt)], ["Request instructions", request.message], ["Response", request.response], ["Response received", instant(request.responseAt)], ["Resolved", instant(request.resolvedAt)]])}</article>`).join("") : "<p>No information requests recorded.</p>");

  const tasks = section("work", "7. Supporting work", data.progress.filter((step) => !step.isSystem).map((step) => {
    const results = events.filter((event) => event.type === "task_result" && event.metadata.stepId === step.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = results[0];
    const result = latest?.metadata.result;
    return `<article><h3>${escape(step.label)}</h3>${fields([["Instructions", step.description], ["Work status", step.isCompleted ? result === "cancelled" ? "Closed without completion" : "Closed — see recorded result" : "Open"], ["Created", instant(step.createdAt)], ["Closed", instant(step.completedAt)]])}${latest ? `<h4>Latest recorded result</h4><p class="answer">${escape(latest.content)}</p>${metadata(latest.metadata)}` : "<p>No result recorded. A closed work item without a result is not evidence of successful completion.</p>"}</article>`;
  }).join("") || "<p>No supporting work recorded.</p>");

  const history = [...events.map((event) => ({ ...event, details: metadata(event.metadata), title: event.type === "progress_update" ? UPDATE_KINDS[event.metadata.kind as keyof typeof UPDATE_KINDS] || "Progress update" : readable(event.type) })), ...notes.map((note) => ({ ...note, details: "", title: "Correspondence / note" }))].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const activity = section("history", "8. Case history and amendments", history.length ? history.map((entry) => `<article class="history"><h3>${escape(entry.title)} <span class="visibility">${entry.visibility === "internal" ? "Internal" : "Shared with policyholder"}</span></h3><p class="meta">${escape(instant(entry.createdAt))} · ${escape(entry.authorName)}</p><p class="answer">${escape(entry.content)}</p>${entry.details}</article>`).join("") : "<p>No case history recorded.</p>");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(claim.claimNumber)} — Claim report</title><style>
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#edf1f5;color:#162536;font:15px/1.6 Arial,Helvetica,sans-serif}main{max-width:1040px;margin:32px auto;background:#fff;padding:48px 56px;border:1px solid #d4dce5;border-radius:8px}header{border-bottom:4px solid #145b69;padding-bottom:24px}h1{font-size:34px;line-height:1.2;margin:12px 0}h2{font-size:23px;border-bottom:1px solid #ced9e1;padding-bottom:12px;margin:0 0 24px;color:#145b69}h3{font-size:17px;margin:24px 0 12px}h4{font-size:15px;margin:12px 0}p{margin:10px 0}a{color:#075a89;text-underline-offset:3px;overflow-wrap:anywhere}.eyebrow{font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#145b69}.subtitle{font-size:18px}.classification{display:inline-block;padding:4px 10px;background:#e8f3f4;font-size:12px;font-weight:bold}.note,.meta,dt{color:#526475}.note{font-size:13px;line-height:1.7}.instructions{border-left:4px solid #145b69;background:#f1f7f8;padding:16px 20px;margin:24px 0}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 32px;margin:16px 0 24px}.field{min-width:0}.wide{grid-column:1/-1}dt{font-size:12px;font-weight:bold;margin-bottom:4px}dd{margin:0}.answer{white-space:pre-wrap;overflow-wrap:anywhere}.nested{background:#f7f9fb;padding:16px;grid-template-columns:repeat(2,minmax(0,1fr))}.answers{padding-left:24px}.answers li{padding:0 0 12px}section{margin:38px 0 0}article{border:1px solid #d7e0e7;border-radius:4px;padding:0 20px 14px;margin:16px 0}article h3{margin-top:16px}.visibility{font-size:11px;font-weight:normal;border:1px solid #ced9e1;border-radius:3px;padding:3px 6px;margin-left:8px}.meta{font-size:12px}.warning{border-left:3px solid #ac6719;padding:8px 12px;background:#fff5e8}nav ol{columns:2;padding-left:24px}nav li{padding:3px 0}footer{margin-top:40px;padding-top:16px;border-top:1px solid #ced9e1;font-size:12px;color:#526475}@media(max-width:680px){main{margin:0;padding:24px 20px;border:0;border-radius:0}.fields,.nested{grid-template-columns:1fr}nav ol{columns:1}h1{font-size:28px}}@page{size:A4;margin:16mm}@media print{html{scroll-behavior:auto}body{background:#fff;font-size:10pt}main{padding:0;border:0;margin:0;max-width:none}header{padding-bottom:12px}h1{font-size:25pt}h2{font-size:16pt}h3{font-size:12pt}nav,.instructions{display:none}section{margin-top:24px}h2,h3,h4,dt{break-after:avoid}h2,h3,h4{break-inside:avoid}.field{break-inside:avoid}.wide{break-inside:auto}article{box-decoration-break:clone}.fields{gap:10px 24px}a{color:inherit}.note{font-size:9pt}footer{font-size:8pt}}
  </style></head><body><main><header><div class="eyebrow">${escape(claim.organizationName)} / Claims</div><h1>Claim report</h1><p class="subtitle">${escape(claim.claimNumber)} · ${escape(claim.policyholderName)}</p><span class="classification">${staff ? "Confidential · Internal review copy" : "Policyholder copy · Shared claim record"}</span><p class="meta">Exported ${escape(instant(exportedAt))} · Record version ${escape(claim.version)}</p></header><div class="instructions"><strong>Review and forward this claim</strong><p>Read this report in any browser. Use the browser’s Print / Save as PDF command for a printable copy. To send the report with supporting originals, forward the complete ZIP package.</p>${staff ? "<p>This copy includes internal findings and correspondence. Share it only through the intended internal claims system.</p>" : ""}</div><nav aria-label="Report contents"><h2>Contents</h2><ol>${[["overview", "Claim overview"], ["policy", "Policy context"], ["form", "Submitted claim form"], ["decision", "Review and recorded decision"], ["evidence", "Supporting documents"], ["requests", "Information requests"], ["work", "Supporting work"], ["history", "Case history and amendments"]].map(([id, title]) => `<li><a href="#${id}">${title}</a></li>`).join("")}</ol></nav>${overview}${policy}${form}${decision}${evidence}${requests}${tasks}${activity}<footer>${escape(claim.claimNumber)} · Exported ${escape(instant(exportedAt))} · ${staff ? "Confidential internal review copy" : "Policyholder copy"}. Changes after export are not reflected in this report.</footer></main></body></html>`;
}
