"use client";

import Link from "next/link";
import { Tabs } from "radix-ui";
import { SubmittedClaimReport } from "./submitted-claim-report";
import { ExportClaimButton } from "./export-claim-button";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentVault } from "@/components/dashboard/user/document-vault";
import {
  DocumentUploader,
  type DocumentUploads,
} from "@/components/claims/document-uploader";
import {
  MOTOR_EVIDENCE_CATEGORIES,
  burglaryEvidenceCategories,
} from "@/components/claims/evidence-categories";
import { uploadClaimDocuments } from "@/lib/upload-claim-documents";
import { recoverEvidenceSelections } from "@/lib/evidence-recovery";
import type { MotorClaimFormData } from "@/lib/schemas/claim-forms";
import { statusLabels, type ClaimStatus } from "@/lib/claim-workflow";
import {
  claimNextAction,
  CLOSED_CLAIM_STATUSES,
} from "@/lib/claim-record-policy";
import {
  getClaimWorkspace,
  addClaimAmendment,
  requestClaimWithdrawal,
} from "@/app/actions/user/my-claims";
import {
  respondToEvidenceRequest,
  createEvidenceRequest,
  resolveEvidenceRequest,
  reviewClaimAttachment,
  recordCarrierHandoff,
} from "@/app/actions/agent/evidence-requests";
import { addClaimNote } from "@/app/actions/agent/manage-claims";
import { recordClaimAssessment } from "@/app/actions/agent/assessment";
import { StatusEditor } from "@/components/dashboard/agent/status-editor";
import { ArrowLeft, Loader2, FileText, Files, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { latestWorkResult, latestAssessedCost } from "@/lib/claim-casework";
import { ProgressEditor } from "@/components/dashboard/agent/progress-editor";
import { claimUpdateSchema, RESPONSIBLE_PARTIES } from "@/lib/claim-communication";

export type ClaimWorkspaceData = Awaited<ReturnType<typeof getClaimWorkspace>>;
const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
function readable(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function TextAction({
  id,
  title,
  label,
  button,
  minLength = 10,
  initialText = "",
  maxLength = 4000,
  disabled,
  onSubmit,
}: {
  id: string;
  title: string;
  label: string;
  button: string;
  minLength?: number;
  initialText?: string;
  maxLength?: number;
  disabled?: boolean;
  onSubmit: (text: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [text, setText] = useState(initialText);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled || pending) return;
        startTransition(async () => {
          try {
            const result = await onSubmit(text);
            if (!result.success) {
              toast.error(result.error || "Could not save");
              return;
            }
            if (!initialText) setText("");
            toast.success("Saved");
            router.refresh();
          } catch {
            toast.error("Could not save. Please retry.");
          }
        });
      }}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        minLength={minLength}
        maxLength={maxLength}
        required
        rows={id === "assessment-summary" ? 8 : 4}
        disabled={disabled || pending}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={disabled || pending || text.trim().length < minLength}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {button}
      </Button>
    </form>
  );
}

export function ClaimWorkspace({
  data,
  demo = false,
}: {
  data: ClaimWorkspaceData;
  demo?: boolean;
}) {
  const {
    claim,
    requests,
    documents,
    events,
    notes,
    progress,
    agent,
    similar,
    role,
  } = data;
  const router = useRouter();
  const staff = role !== "user";
  const closed = CLOSED_CLAIM_STATUSES.has(claim.status);
  const reviewOpen = !closed && claim.status !== "approved";
  const canAssess = [
    "assigned",
    "surveyor_dispatched",
    "under_review",
    "awaiting_information",
  ].includes(claim.status);
  const openRequests = requests.filter((r) => r.status !== "resolved");
  const [activityFilter, setActivityFilter] = useState("all");
  const workResults = progress.filter((step) => !step.isSystem).map((step) => ({ step, result: latestWorkResult(step.id, events) })).filter((entry) => entry.result).sort((a, b) => b.result!.createdAt.localeCompare(a.result!.createdAt));
  const recommendation = workResults.find((entry) => entry.step.isCompleted && ["recommend_approval", "recommend_rejection"].includes(entry.result!.result))?.result;
  const costResult = latestAssessedCost(events);
  const [caseAction, setCaseAction] = useState<"review" | "message" | null>(null);
  const [completeReview, setCompleteReview] = useState(false);
  const unreviewed = documents.filter((d) => !["accepted", "waived"].includes(d.reviewStatus));
  const repliedRequests = openRequests.filter((r) => r.status === "responded");
  const [uploads, setUploads] = useState<DocumentUploads>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [requestTitle, setRequestTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestCategory, setRequestCategory] = useState("other");
  const [dueAt, setDueAt] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"public" | "internal">(
    "internal",
  );
  const [handoffSource, setHandoffSource] = useState<"manual" | "simulated">(
    "manual",
  );
  const [carrierReference, setCarrierReference] = useState("");
  const report = data.submittedReport;
  const [activeTab, setActiveTab] = useState("report");
  useEffect(() => {
    const followHash = () => {
      const section = window.location.hash.slice(1);
      if (["documents", "document-review", "add-evidence", "information-requests"].includes(section)) setActiveTab("evidence");
      else if (["assessment", "claim-stage"].includes(section) && staff) { setActiveTab("work"); setCaseAction("review"); }
      else if (["publish-update", "claim-progress"].includes(section)) setActiveTab("work");
      else if (section === "claim-activity") setActiveTab("work");
      else if (section === "original-report") setActiveTab("report");
    };
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, [staff]);
  const receivedDocuments = documents.filter((doc) => doc.uploadState === "ready");
  const tabs = [
    { value: "report", label: "Claim form", icon: FileText },
    { value: "evidence", label: "Evidence", icon: Files, count: documents.length },
    { value: "work", label: staff ? "Case work" : "Progress & history", icon: ListChecks },
  ];
  const holderAvailable = claim.policyholderName !== "Account unavailable";
  const lossItems = (
    Array.isArray(claim.formData?.lossItems) ? claim.formData.lossItems : []
  )
    .filter(
      (item): item is { itemKey: string; description: string } =>
        !!item &&
        typeof item === "object" &&
        "itemKey" in item &&
        "description" in item,
    )
    .map((item) => ({
      itemKey: String(item.itemKey),
      description: String(item.description),
    }));
  const categories =
    claim.policyType === "motor"
      ? MOTOR_EVIDENCE_CATEGORIES.filter(
          (c) =>
            (claim.formData?.incidentType === "accident" ||
              c.key !== "driving_license") &&
            (claim.formData?.incidentType !== "theft" ||
              c.key !== "repair_estimate"),
        )
      : burglaryEvidenceCategories(
          String(claim.formData?.premisesUse ?? "unknown"),
        );
  const reminders = (
    Array.isArray(claim.formData?.pendingEvidence)
      ? claim.formData.pendingEvidence
      : []
  ) as MotorClaimFormData["pendingEvidence"];
  const unselectedReminders = reminders.filter(
    (item) =>
      !documents.some((doc) => doc.clientUploadId === item.clientUploadId) &&
      !Object.values(uploads)
        .flat()
        .some((file) => file.id === item.clientUploadId),
  );
  function changeUploads(next: DocumentUploads) {
    setUploads(recoverEvidenceSelections(next, documents, reminders));
  }
  async function sendFiles(fileIds?: string[]) {
    if (demo || uploading || !reviewOpen) return;
    setUploading(true);
    try {
      const result = await uploadClaimDocuments(
        claim.id,
        claim.organizationId,
        uploads,
        {
          fileIds,
          onProgress: (event) =>
            setUploads((current) =>
              Object.fromEntries(
                Object.entries(current).map(([category, files]) => [
                  category,
                  files.map((file) =>
                    file.id === event.fileId
                      ? {
                          ...file,
                          status: event.status,
                          progress: event.progress,
                          error: event.error,
                          attachmentId: event.attachmentId,
                        }
                      : file,
                  ),
                ]),
              ),
            ),
        },
      );
      if (result.failed)
        toast.error(
          `${result.failed} file${result.failed === 1 ? "" : "s"} need retry. Your claim is still submitted.`,
        );
      else toast.success("Documents received for manual review");
      router.refresh();
    } catch {
      toast.error(
        "Document upload failed. Your claim remains saved; retry the files.",
      );
    } finally {
      setUploading(false);
    }
  }
  function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (demo || pending || !reviewOpen) return;
    startTransition(async () => {
      try {
        const result = await createEvidenceRequest(claim.id, {
          title: requestTitle,
          message: requestMessage,
          category: requestCategory,
          dueAt: dueAt ? `${dueAt}:00+03:00` : undefined,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setRequestTitle("");
        setRequestMessage("");
        toast.success("Information request saved");
        router.refresh();
      } catch {
        toast.error("Could not save request");
      }
    });
  }
  const disabled = demo || uploading;
  return (
    <div className="claim-workspace space-y-6">
      {demo && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Prototype preview · synthetic data · saving and document access are disabled.</p>}
      <Link href={demo ? "/prototype" : staff ? "/claims" : "/dashboard/user"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />{staff ? "All claims" : "Dashboard"}</Link>
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-primary">{claim.policyType === "motor" ? "Motor" : "Burglary"} claim · {claim.organizationName} · {role === "user" ? "Policyholder view" : role === "head_agent" ? "Claims manager view" : role === "admin" ? "Administrator view" : "Agent view"}</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{claim.policyType === "motor" ? String(report?.registrationNumber || "Vehicle claim") : String(report?.premisesLocation || "Premises claim")}</h1>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground" title="Claim reference">{claim.claimNumber}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary" className="px-3 py-1.5 text-sm">{statusLabels[claim.status as ClaimStatus]}</Badge>{!demo && <ExportClaimButton claimId={claim.id} claimNumber={claim.claimNumber} />}</div>
        </div>
        <dl className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0"><dt className="text-sm text-muted-foreground">Policyholder</dt><dd className="mt-1 break-words text-base font-semibold">{holderAvailable ? claim.policyholderName : "Name unavailable"}</dd><dd className="mt-1 break-words text-sm text-muted-foreground">{claim.policyholderEmail || (holderAvailable ? "Email not recorded" : "Account profile unavailable; verify identity from the submitted evidence.")}{claim.contactPhone && <span className="mt-1 block">{claim.contactPhone}</span>}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-muted-foreground">Policy</dt><dd className="mt-1 break-words text-base font-semibold">{claim.policyNumber}</dd><dd className="mt-1 text-sm text-muted-foreground">{claim.policyType === "motor" ? "Motor insurance" : "Burglary insurance"}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-muted-foreground">{report?.incidentTiming === "approximate" ? "Incident date range" : report?.incidentDate ? "Incident date" : "Discovered"}</dt><dd className="mt-1 text-base font-semibold">{report?.incidentTiming === "approximate" ? `${report.incidentRangeStart || "Unknown"} – ${report.incidentRangeEnd || "Unknown"}` : String(report?.incidentDate || report?.discoveryDate || claim.incidentDate || "Unknown")}</dd><dd className="mt-1 text-sm text-muted-foreground">{claim.submittedAt ? `Submitted ${formatDate(claim.submittedAt)}` : "Submission date not recorded"}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-muted-foreground">Assigned agent</dt><dd className="mt-1 break-words text-base font-semibold">{agent?.name || "Not assigned"}</dd>{agent && <dd className="mt-1 break-words text-sm"><a className="text-primary underline-offset-4 hover:underline" href={`mailto:${agent.email}`}>{agent.email}</a>{agent.phone && <a className="mt-1 block text-muted-foreground" href={`tel:${agent.phone}`}>{agent.phone}</a>}</dd>}</div>
        </dl>
        {(claim.withdrawalRequestedAt || similar.length > 0) && <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{claim.withdrawalRequestedAt && <p>Withdrawal requested {formatDate(claim.withdrawalRequestedAt)}. A manager must review the request.</p>}{similar.length > 0 && <p>Other reports on this policy share the incident date: {similar.map((item) => item.claimNumber).join(", ")}. Check for duplicate reporting.</p>}</div>}
        {staff && <div className="flex flex-wrap gap-2" aria-label="Outstanding claim work">
          <Button variant="outline" onClick={() => setActiveTab("evidence")}>{receivedDocuments.length} of {documents.length} files received · {unreviewed.filter((doc) => doc.uploadState === "ready").length} awaiting inspection</Button>
          <Button variant="outline" onClick={() => setActiveTab("evidence")}>{repliedRequests.length} replies to review · {openRequests.length} open requests</Button>
          <Button variant="outline" onClick={() => setActiveTab("work")}>{progress.filter((step) => !step.isSystem && !step.isCompleted).length} outstanding next actions</Button>
        </div>}
        {!staff && <p className="rounded-xl border bg-card p-4 text-base leading-7">{claimNextAction(claim.status, openRequests.filter((r) => r.status === "open").length)}</p>}
      </header>
      <Tabs.Root value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        document.getElementById("claim-file-tabs")?.scrollIntoView({ block: "start" });
      }} className="min-w-0">
        <Tabs.List id="claim-file-tabs" aria-label="Claim file sections" className="sticky top-16 z-30 mb-6 flex scroll-mt-16 gap-1 overflow-x-auto border-b bg-background/95 backdrop-blur">
          {tabs.map(({ value, label, icon: Icon, ...tab }) => <Tabs.Trigger key={value} value={value} className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-4 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary"><Icon className="size-4" />{label}{"count" in tab && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{tab.count}</span>}</Tabs.Trigger>)}
        </Tabs.List>
        <Tabs.Content value="report" forceMount className="space-y-6 outline-none data-[state=inactive]:hidden">
          {report && <div className="grid gap-5 rounded-xl border bg-card p-6 sm:grid-cols-2">
            <div><p className="text-sm text-muted-foreground">{claim.policyType === "motor" ? "Driver named in the report" : "Premises use"}</p><p className="mt-1 break-words text-lg font-semibold">{String(claim.policyType === "motor" ? report.driverFullName || "Not provided" : report.premisesUse || "Not provided")}</p></div>
            <div><p className="text-sm text-muted-foreground">{claim.policyType === "motor" ? "Incident location" : "Premises location"}</p><p className="mt-1 break-words text-base font-medium leading-7">{String(report.incidentLocation || report.premisesLocation || "Not provided")}</p></div>
          </div>}
          {!demo && <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-6"><p className="font-medium">Share a complete claim for review</p><p className="text-muted-foreground">Export a ZIP with a readable, printable report and the original supporting documents. Recipients can extract it and open report.html without portal access.{staff ? " Staff exports include internal findings and notes for your internal review team." : " Your export includes the claim information shared with you."}</p></div>}
          <SubmittedClaimReport report={report} source={data.reportSource} />
          <Card>
            <CardHeader><CardTitle>Policy recorded at submission</CardTitle><CardDescription>Use this context alongside the policy wording and evidence when assessing coverage.</CardDescription></CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                {[["Insurer policy reference", claim.policySnapshot?.insurerReference], ["Insured asset", claim.policySnapshot?.insuredAsset], ["Coverage start", claim.policySnapshot?.coverageStart], ["Coverage end", claim.policySnapshot?.coverageEnd], ["Coverage summary", claim.policySnapshot?.coverageSummary]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-sm text-muted-foreground">{String(label)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-base leading-7">{value ? String(value) : "Not recorded"}</dd></div>)}
              </dl>
            </CardContent>
          </Card>
        </Tabs.Content>
        <Tabs.Content value="evidence" forceMount className="space-y-6 outline-none data-[state=inactive]:hidden">
          <DocumentVault documents={documents} claimId={claim.id} staff={staff} demo={demo} active={activeTab === "evidence"} renderReview={staff && reviewOpen ? (doc) => <DocumentReview key={`${doc.id}:${doc.reviewStatus}`} doc={doc} disabled={disabled} /> : undefined} />
          {reviewOpen && (
            <Card id="add-evidence">
              <details>
                <summary className="cursor-pointer px-6 text-base font-semibold text-primary">Add documents or retry an upload</summary>
              <CardHeader>
                <CardTitle>Add supporting documents</CardTitle>
                <CardDescription>
                  50 MB per file, 20 files and 150 MB per claim. New files wait
                  for manual inspection. You can retry failed files separately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!demo && !data.storageReady && <p role="status" className="rounded-lg border p-3 text-sm">Evidence storage is not available yet. Your claim remains saved. You can select files and return to upload them when storage is configured.</p>}
                {unselectedReminders.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Files selected in your original report need selecting again:{" "}
                    {unselectedReminders.map((item) => item.name).join(", ")}.
                    Browsers cannot keep the file contents after refresh.
                  </p>
                )}
                <DocumentUploader
                  categories={categories}
                  uploads={uploads}
                  onUploadsChange={changeUploads}
                  onRetry={data.storageReady ? (id) => sendFiles([id]) : undefined}
                  disabled={uploading || demo}
                  lossItems={lossItems}
                />
                <Button
                  disabled={
                    uploading ||
                    demo || !data.storageReady ||
                    !Object.values(uploads).some((files) =>
                      files.some((file) => file.status !== "uploaded"),
                    )
                  }
                  onClick={() => sendFiles()}
                >
                  {uploading && <Loader2 className="size-4 animate-spin" />}
                  Upload documents
                </Button>
              </CardContent>
              </details>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle id="information-requests">Information requests</CardTitle>
              <CardDescription>
                Explain unavailable evidence in your response. A missing
                document does not remove your report.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {requests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No information requests at the moment.
                </p>
              )}
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="space-y-4 rounded-xl border bg-muted/15 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="text-sm font-semibold">{request.title}</h3>
                    <Badge variant="secondary">
                      {closed
                        ? "Claim closed · no response required"
                        : request.status === "responded"
                          ? "Response received"
                          : request.status === "resolved"
                            ? "Complete"
                            : "Action required"}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {request.message}
                  </p>
                  {request.dueAt && (
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(request.dueAt)}
                      {!closed &&
                      request.status !== "resolved" &&
                      new Date(request.dueAt).getTime() < Date.now()
                        ? " · Overdue"
                        : ""}
                    </p>
                  )}
                  {request.resolvedAt && <p className="text-xs text-muted-foreground">Completed {formatDate(request.resolvedAt)}</p>}
                  {request.response && (
                    <p className="rounded-md bg-muted p-3 text-sm">
                      {staff ? "Policyholder response" : "Your response"}: {request.response}
                    </p>
                  )}
                  {request.status !== "resolved" &&
                    !closed &&
                    (staff ? (
                      <TextAction
                        id={`resolve-${request.id}`}
                        title="Complete this request"
                        label="How was this request satisfied or waived?"
                        button="Mark complete"
                        minLength={5}
                        disabled={disabled}
                        onSubmit={(text) =>
                          resolveEvidenceRequest(request.id, text)
                        }
                      />
                    ) : (
                      <TextAction
                        id={`response-${request.id}`}
                        title={
                          request.response
                            ? "Update your response"
                            : "Reply to your agent"
                        }
                        label="Describe what you have supplied or why it is unavailable"
                        button="Send response"
                        minLength={2}
                        disabled={disabled}
                        onSubmit={(text) =>
                          respondToEvidenceRequest(request.id, text)
                        }
                      />
                    ))}
                </div>
              ))}
            </CardContent>
          </Card>
          {staff && reviewOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Request information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createRequest}>
                  <fieldset
                    disabled={disabled || pending}
                    className="space-y-3"
                  >
                    <Label htmlFor="request-title">Request title</Label>
                    <Input
                      id="request-title"
                      value={requestTitle}
                      onChange={(e) => setRequestTitle(e.target.value)}
                      minLength={3}
                      maxLength={200}
                      required
                    />
                    <Label htmlFor="request-category">Document category</Label>
                    <select
                      id="request-category"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={requestCategory}
                      onChange={(e) => setRequestCategory(e.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <Label htmlFor="request-message">
                      Instructions and alternatives
                    </Label>
                    <Textarea
                      id="request-message"
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      minLength={10}
                      maxLength={4000}
                      required
                    />
                    <Label htmlFor="request-due">
                      Deadline (Nairobi time, optional)
                    </Label>
                    <Input
                      id="request-due"
                      type="datetime-local"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                    <Button disabled={disabled || pending} type="submit">
                      Save request
                    </Button>
                  </fieldset>
                </form>
              </CardContent>
            </Card>
          )}
        </Tabs.Content>
        <Tabs.Content value="work" forceMount className="space-y-6 outline-none data-[state=inactive]:hidden">
          <div><h2 className="text-xl font-semibold">{staff ? "Work the claim" : "Claim progress & history"}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{staff ? "Record an activity and its next action. When that action is finished, record its result or follow-up. Each entry updates the policyholder’s history automatically." : "See what has happened, who acts next, the expected update time and the outcome of each action."}</p></div>
          {recommendation && !closed && claim.status !== "approved" && <Card className="border-amber-500/30"><CardHeader><CardTitle>A work result needs a claim decision</CardTitle><CardDescription>{recommendation.result === "recommend_rejection" ? "Rejection has been recommended. The claim has not been rejected." : "Approval has been recommended. The claim has not been approved."}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap text-base leading-7">{recommendation.summary}</p>{staff && <Button variant="outline" onClick={() => setCaseAction("review")}>Review findings & decide claim</Button>}</CardContent></Card>}
          <RecordedOutcome claim={claim} />
          {staff && <div className="flex flex-wrap gap-2" aria-label="Case actions"><Button variant={caseAction === "review" ? "default" : "outline"} aria-pressed={caseAction === "review"} onClick={() => setCaseAction(caseAction === "review" ? null : "review")}>Review findings & decide claim</Button>{!closed && <Button variant={caseAction === "message" ? "default" : "outline"} aria-pressed={caseAction === "message"} onClick={() => setCaseAction(caseAction === "message" ? null : "message")}>Message / internal note</Button>}<Button variant="outline" onClick={() => setActiveTab("evidence")}>Inspect evidence / request information</Button></div>}
          {staff && <section id="case-review" hidden={caseAction !== "review"} className="scroll-mt-36 space-y-6">
            {claim.estimatedLossAmount && <Card><CardHeader><CardTitle>Recorded assessed cost</CardTitle><CardDescription>The assessed cost and its source are recorded with the relevant work result.</CardDescription></CardHeader><CardContent><p className="text-lg font-semibold">KES {Number(claim.estimatedLossAmount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</p>{costResult ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">Source: {costResult.assessmentBasis} · Recorded {formatDate(costResult.createdAt)}</p> : <p className="mt-2 text-sm text-muted-foreground">Previously recorded figure; no source has been linked to a work result.</p>}</CardContent></Card>}
          {staff && (canAssess || claim.assessmentSummary) && (
            <Card>
              <CardHeader>
                <CardTitle id="assessment">Assessment</CardTitle>
                <CardDescription>
                  Internal review summary. Estimates do not establish coverage
                  or payment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {claim.assessmentSummary && (
                  <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                    {claim.assessmentSummary}
                  </p>
                )}
                {canAssess && (
                  <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={completeReview} onChange={(event) => setCompleteReview(event.target.checked)} disabled={disabled} />Review is complete — submit these findings for a manager’s decision</label>
                    <TextAction
                      key={claim.assessedAt ?? "new-assessment"}
                      id="assessment-summary"
                      initialText={claim.assessmentSummary ?? recommendation?.summary ?? ""}
                      maxLength={5000}
                      title="Record or revise assessment"
                      label="Explain the evidence, review and remaining uncertainties"
                      button={completeReview ? "Submit findings for decision" : "Save assessment findings"}
                      minLength={20}
                      disabled={disabled}
                      onSubmit={(text) =>
                        recordClaimAssessment(claim.id, {
                          summary: text,
                          completeReview,
                        })
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {!canAssess && !claim.assessmentSummary && <p className="rounded-xl border bg-card p-6 text-base">{closed ? "This claim is closed. A manager must reopen review before an assessment can be recorded." : claim.status === "pending" ? "Assign this claim to an agent before recording an assessment." : "The assessment stage has ended. Review the recorded outcome or update the claim stage below."}</p>}
          <div id="claim-stage" className="grid scroll-mt-36 items-start gap-6 lg:grid-cols-2">
          {staff && !demo && (
            <StatusEditor
              key={`${claim.id}:${claim.version}`}
              claimId={claim.id}
              claimNumber={claim.claimNumber}
              currentStatus={claim.status as ClaimStatus}
              role={role}
              assessmentSummary={claim.assessmentSummary ?? recommendation?.summary ?? null}
            />
          )}
          <details className="rounded-xl border p-5"><summary className="cursor-pointer text-sm font-medium text-primary">Insurer handoff details</summary><div className="mt-5 space-y-5">          <Card>
            <CardHeader>
              <CardTitle>Insurer handoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                {claim.carrierHandoffState === "not_sent"
                  ? "No handoff recorded"
                  : claim.carrierHandoffState === "simulated"
                    ? "Simulated handoff"
                    : "Manual handoff recorded"}
              </p>
              {claim.carrierReference && (
                <p className="break-all">Reference: {claim.carrierReference}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Insurance company integration is outside this prototype.
              </p>
            </CardContent>
          </Card>
          {staff && !closed && (
            <Card>
              <CardHeader>
                <CardTitle>Record manual handoff</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="handoff-source">Source</Label>
                <select
                  id="handoff-source"
                  disabled={disabled}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={handoffSource}
                  onChange={(e) =>
                    setHandoffSource(e.target.value as "manual" | "simulated")
                  }
                >
                  <option value="manual">Manually recorded</option>
                  <option value="simulated">Simulated</option>
                </select>
                <Label htmlFor="carrier-reference">External reference</Label>
                <Input
                  id="carrier-reference"
                  disabled={disabled}
                  value={carrierReference}
                  onChange={(e) => setCarrierReference(e.target.value)}
                  maxLength={100}
                />
                <TextAction
                  id="handoff-reason"
                  title="Handoff details"
                  label="Explain the external or simulated handoff"
                  button="Record handoff"
                  disabled={disabled || carrierReference.trim().length < 3}
                  onSubmit={(text) =>
                    recordCarrierHandoff(claim.id, {
                      state: handoffSource,
                      reference: carrierReference,
                      reason: text,
                    })
                  }
                />
              </CardContent>
            </Card>
          )}
</div></details>
          <RecordedOutcome claim={claim} />
          </div>
          </section>}
          {staff && <section hidden={caseAction !== "message"}>
          {staff && !closed && (
            <Card>
              <CardHeader>
                <CardTitle>Add a note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="note-visibility">Who can read it?</Label>
                <select
                  id="note-visibility"
                  disabled={disabled}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={noteVisibility}
                  onChange={(e) =>
                    setNoteVisibility(e.target.value as "public" | "internal")
                  }
                >
                  <option value="public">Policyholder and staff</option>
                  <option value="internal">Staff only</option>
                </select>
                <TextAction
                  id="staff-note"
                  title={
                    noteVisibility === "internal"
                      ? "Internal note"
                      : "Message to policyholder"
                  }
                  label="Message"
                  minLength={2}
                  button="Save note"
                  disabled={disabled}
                  onSubmit={(text) =>
                    addClaimNote(claim.id, text, noteVisibility)
                  }
                />
              </CardContent>
            </Card>
          )}
          </section>}
          <ProgressEditor key={`${claim.id}:${claim.version}`} claimId={claim.id} claimNumber={claim.claimNumber} initialSteps={progress.filter((step) => !step.isSystem)} events={events} documents={documents} role={role} readOnly={demo || !staff || closed} onReviewDecision={staff ? () => { setCaseAction("review"); window.requestAnimationFrame(() => document.getElementById("case-review")?.scrollIntoView({ block: "start" })); } : undefined} />
          <Card id="claim-activity">
            <CardHeader>
              <CardTitle>
                {staff ? "Case history" : "Your claim history"}
              </CardTitle>
              <CardDescription>
                {staff
                  ? "Internal activity is labeled and visible only to staff with access."
                  : "Updates, replies and amendments visible to you."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="block text-sm">Filter activity
                <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} className="ml-3 rounded-md border bg-background p-2">
                  <option value="all">All activity</option><option value="updates">Progress updates</option><option value="documents">Documents</option><option value="messages">Messages</option>{staff && <option value="internal">Internal only</option>}
                </select>
              </label>
              {[
                ...events.map((event) => ({
                  id: event.id,
                  content: event.content,
                  at: event.createdAt,
                  visibility: event.visibility,
                  label: `${readable(event.type.replaceAll("_", " "))} · ${event.authorName}`,
                  kind: event.type,
                  update: event.type === "progress_update" ? claimUpdateSchema.safeParse(event.metadata) : null,
                })),
                ...notes.map((note) => ({
                  id: note.id,
                  content: note.content,
                  at: note.createdAt,
                  visibility: note.visibility,
                  label: `Message from ${note.authorName}`,
                  kind: "message", update: null,
                })),
              ]
                .filter((item) => activityFilter === "all" || (activityFilter === "updates" ? item.kind === "progress_update" || item.kind.startsWith("task_") || item.kind === "assessment_submitted" || item.kind === "status_changed" : activityFilter === "documents" ? item.kind.startsWith("document_") : activityFilter === "messages" ? item.kind === "message" || item.kind === "amendment" : item.visibility === "internal"))
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((item) => (
                  <div
                    key={item.id}
                    className="relative rounded-r-lg border-l-2 border-primary/30 bg-muted/20 py-3 pl-4 pr-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.at)} · {item.label}
                      {item.visibility === "internal" ? " · Internal" : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {item.content}
                    </p>
                    {item.update?.success && <div className="mt-3"><UpdateDetails update={item.update.data} /></div>}
                  </div>
                ))}
            </CardContent>
          </Card>
          {!closed && !staff && <Card><CardHeader><CardTitle>Ask your claims team</CardTitle><CardDescription>For questions or general information. Use the request reply above when answering a specific information request.</CardDescription></CardHeader><CardContent><TextAction id="policyholder-message" title="Message to your agent" label="Your question or update" minLength={2} button="Send message" disabled={disabled} onSubmit={(text) => addClaimNote(claim.id, text, "public")} /></CardContent></Card>}
          {!closed && !staff && (
            <Card>
              <CardHeader>
                <CardTitle>Add an amendment</CardTitle>
                <CardDescription>
                  Correct or add information while preserving your original
                  report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TextAction
                  id="amendment"
                  title="Additional information"
                  label="What would you like to correct or add?"
                  button="Save amendment"
                  disabled={disabled}
                  onSubmit={(text) => addClaimAmendment(claim.id, text)}
                />
              </CardContent>
            </Card>
          )}
          {!staff && !closed && !claim.withdrawalRequestedAt && (
            <Card>
              <CardHeader>
                <CardTitle>Request withdrawal</CardTitle>
                <CardDescription>
                  A manager reviews the request. Your report and history remain
                  available.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TextAction
                  id="withdrawal-reason"
                  title="Withdrawal reason"
                  label="Why do you want to withdraw this claim?"
                  button="Request withdrawal"
                  disabled={disabled}
                  onSubmit={(text) => requestClaimWithdrawal(claim.id, text)}
                />
              </CardContent>
            </Card>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function RecordedOutcome({ claim }: { claim: ClaimWorkspaceData["claim"] }) {
  return <>
          {(claim.outcomeReason || claim.settlementReference) && (
            <Card>
              <CardHeader>
                <CardTitle>Recorded outcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Badge variant="secondary">
                  {claim.outcomeSource === "simulated"
                    ? "Simulated outcome"
                    : "Manually recorded outcome"}
                </Badge>
                {claim.outcomeReason && <p>{claim.outcomeReason}</p>}
                {claim.status === "settled" &&
                claim.settlementAmount &&
                claim.settlementReference ? (
                  <>
                    <p className="font-semibold">
                      KES{" "}
                      {Number(claim.settlementAmount).toLocaleString("en-KE", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="break-all">
                      Reference: {claim.settlementReference}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {claim.outcomeSource === "simulated"
                        ? "Demonstration only. No payment was made."
                        : "An external settlement was recorded by staff. The portal has not verified or dispatched a payment."}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No settlement with an amount and evidence reference has been
                    recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
  </>;
}

function DocumentReview({
  doc,
  disabled,
}: {
  doc: ClaimWorkspaceData["documents"][number];
  disabled: boolean;
}) {
  const [status, setStatus] = useState<
    "accepted" | "needs_replacement" | "waived"
  >(doc.uploadState === "ready" ? "accepted" : "waived");
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <h3 className="text-base font-semibold">Record evidence inspection</h3>
      <p className="text-sm leading-6 text-muted-foreground">Inspect the original before accepting it. The result and inspection note are visible to the policyholder.</p>
      <Label htmlFor={`review-${doc.id}`}>Inspection result</Label>
      <select
        id={`review-${doc.id}`}
        disabled={disabled || doc.uploadState === "uploading"}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
      >
        <option disabled={doc.uploadState !== "ready"} value="accepted">
          Accept after manual inspection
        </option>
        <option
          disabled={doc.uploadState !== "ready"}
          value="needs_replacement"
        >
          Request replacement
        </option>
        <option value="waived">Waive with a recorded reason</option>
      </select>
      <TextAction
        id={`review-note-${doc.id}`}
        title="Record your inspection"
        label="Inspection note or replacement instructions"
        button="Save inspection"
        minLength={5}
        maxLength={2000}
        disabled={disabled || doc.uploadState === "uploading"}
        onSubmit={(text) =>
          reviewClaimAttachment(doc.id, { status, note: text })
        }
      />
    </div>
  );
}

function UpdateDetails({ update }: { update: import("@/lib/claim-communication").ClaimUpdate }) {
  return <dl className="space-y-2 text-sm">
    <div><dt className="font-medium">Who acts next</dt><dd>{RESPONSIBLE_PARTIES[update.responsibleParty]}</dd></div>
    <div><dt className="font-medium">Next action</dt><dd className="whitespace-pre-wrap">{update.nextAction}</dd></div>
    {update.waitingReason && <div><dt className="font-medium">Waiting / delay</dt><dd className="whitespace-pre-wrap">{update.waitingReason}</dd></div>}
    {update.nextUpdateAt && <div><dt className="font-medium">Next update expected</dt><dd>{formatDate(update.nextUpdateAt)} EAT</dd></div>}
    {update.appointmentAt && <div><dt className="font-medium">Arranged appointment</dt><dd>{formatDate(update.appointmentAt)} EAT{update.appointmentLocation && ` · ${update.appointmentLocation}`}</dd></div>}
    {update.contactDetails && <div><dt className="font-medium">Contact / instructions</dt><dd className="whitespace-pre-wrap">{update.contactDetails}</dd></div>}
  </dl>;
}
