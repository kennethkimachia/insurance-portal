"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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
import { ArrowLeft, Download, Mail, Phone, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type ClaimWorkspaceData = Awaited<ReturnType<typeof getClaimWorkspace>>;
const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
function readable(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function OriginalReport({
  report,
}: {
  report: Record<string, unknown> | null;
}) {
  if (!report)
    return (
      <p className="text-sm text-muted-foreground">
        This older claim has no preserved form snapshot. Ask your agent for the
        original report.
      </p>
    );
  const groups = Object.entries(report).filter(
    ([key]) =>
      !["pendingEvidence", "itemKey", "policyId", "claimId"].includes(key),
  );
  return (
    <div className="space-y-5">
      {groups.map(([key, value]) => (
        <div key={key}>
          <p className="text-xs font-medium text-muted-foreground">
            {readable(key)}
          </p>
          {Array.isArray(value) ? (
            value.length ? (
              <div className="mt-2 space-y-2">
                {value.map((item, index) => (
                  <dl
                    key={index}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
                  >
                    {Object.entries(item as Record<string, unknown>)
                      .filter(([field]) => field !== "itemKey")
                      .map(([field, entry]) => (
                        <div key={field}>
                          <dt className="text-xs text-muted-foreground">
                            {readable(field)}
                          </dt>
                          <dd className="break-words text-sm">
                            {entry === "" || entry == null
                              ? "Not provided"
                              : typeof entry === "boolean"
                                ? entry
                                  ? "Yes"
                                  : "No"
                                : String(entry).replaceAll("_", " ")}
                          </dd>
                        </div>
                      ))}
                  </dl>
                ))}
              </div>
            ) : (
              <p className="text-sm">None reported at submission</p>
            )
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {value === "" || value == null
                ? "Not provided"
                : typeof value === "boolean"
                  ? value
                    ? "Confirmed"
                    : "No"
                  : String(value).replaceAll("_", " ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function TextAction({
  id,
  title,
  label,
  button,
  minLength = 10,
  disabled,
  onSubmit,
}: {
  id: string;
  title: string;
  label: string;
  button: string;
  minLength?: number;
  disabled?: boolean;
  onSubmit: (text: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [text, setText] = useState("");
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
            setText("");
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
        maxLength={4000}
        required
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
  const [uploads, setUploads] = useState<DocumentUploads>({});
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [requestTitle, setRequestTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestCategory, setRequestCategory] = useState("other");
  const [dueAt, setDueAt] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"public" | "internal">(
    "public",
  );
  const [lossEstimate, setLossEstimate] = useState(
    claim.estimatedLossAmount ?? "",
  );
  const [handoffSource, setHandoffSource] = useState<"manual" | "simulated">(
    "manual",
  );
  const [carrierReference, setCarrierReference] = useState("");
  const report = claim.originalSubmission;
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
    <div className="claim-workspace space-y-7">
      {demo && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-200">
          Prototype preview · synthetic data · account, storage and insurer
          actions are disabled.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={demo ? "/prototype" : staff ? "/claims" : "/dashboard/user"}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            {staff ? "Claims" : "Dashboard"}
          </Link>
          <h1 className="portal-heading break-all font-mono">
            {claim.claimNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {claim.policyType === "motor" ? "Motor" : "Burglary"} ·{" "}
            {claim.policyNumber} · {claim.organizationName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">
            {statusLabels[claim.status as ClaimStatus]}
          </Badge>
          {!demo && (
            <Button asChild variant="outline">
              <Link href={`/api/claims/${claim.id}/export`}>
                <Download />
                Download report
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardHeader>
          <CardTitle>What happens next</CardTitle>
          <CardDescription>
            {claimNextAction(claim.status, openRequests.length)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {claim.submittedAt && (
            <p>
              Received {formatDate(claim.submittedAt)}. This receipt confirms
              your report was saved in the portal.
            </p>
          )}
          {claim.withdrawalRequestedAt && (
            <p className="font-medium">
              Withdrawal requested {formatDate(claim.withdrawalRequestedAt)}. A
              manager must review this request.
            </p>
          )}
          {similar.length > 0 && (
            <p className="text-amber-700 dark:text-amber-400">
              Another report for this policy has the same incident date:{" "}
              {similar.map((s) => s.claimNumber).join(", ")}. Contact your agent
              if these describe the same incident.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Your insurer must confirm coverage and the final outcome. The portal
            does not send payments or automatically submit claims to an insurer.
          </p>
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Information requests</CardTitle>
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
                      {closed && request.status !== "resolved"
                        ? "No response required: claim closed"
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
                  {request.response && (
                    <p className="rounded-md bg-muted p-3 text-sm">
                      Your response: {request.response}
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
          <DocumentVault
            documents={documents}
            claimId={claim.id}
            staff={staff}
            demo={demo}
          />
          {reviewOpen && (
            <Card id="add-evidence">
              <CardHeader>
                <CardTitle>Add supporting documents</CardTitle>
                <CardDescription>
                  50 MB per file, 20 files and 150 MB per claim. New files wait
                  for manual inspection. You can retry failed files separately.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  onRetry={(id) => sendFiles([id])}
                  disabled={uploading || demo}
                  lossItems={lossItems}
                />
                <Button
                  disabled={
                    uploading ||
                    demo ||
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
            </Card>
          )}
          {staff &&
            reviewOpen &&
            documents.some(
              (doc) => !["accepted", "waived"].includes(doc.reviewStatus),
            ) && (
              <Card>
                <CardHeader>
                  <CardTitle>Document inspection</CardTitle>
                  <CardDescription>
                    Download files for inspection before accepting them.
                    Acceptance records a manual review; it is not an automated
                    malware scan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {documents
                    .filter(
                      (doc) =>
                        !["accepted", "waived"].includes(doc.reviewStatus),
                    )
                    .map((doc) => (
                      <DocumentReview
                        key={doc.id}
                        doc={doc}
                        disabled={disabled}
                      />
                    ))}
                </CardContent>
              </Card>
            )}
          <Card>
            <CardHeader>
              <CardTitle>
                {staff ? "Claim activity" : "Your claim history"}
              </CardTitle>
              <CardDescription>
                {staff
                  ? "Internal activity is labeled and visible only to staff with access."
                  : "Updates, replies and amendments visible to you."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                ...events.map((event) => ({
                  id: event.id,
                  content: event.content,
                  at: event.createdAt,
                  visibility: event.visibility,
                  label: readable(event.type.replaceAll("_", " ")),
                })),
                ...notes.map((note) => ({
                  id: note.id,
                  content: note.content,
                  at: note.createdAt,
                  visibility: note.visibility,
                  label: `Message from ${note.authorName}`,
                })),
              ]
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
                  </div>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Original incident report</CardTitle>
              <CardDescription>
                The report submitted at{" "}
                {claim.submittedAt
                  ? formatDate(claim.submittedAt)
                  : "first notice"}
                . Later amendments appear in the history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer rounded-lg border bg-muted/20 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent">
                  View submitted answers
                </summary>
                <div className="mt-5">
                  <OriginalReport report={report} />
                </div>
              </details>
            </CardContent>
          </Card>
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
        </div>
        <aside className="claim-workspace space-y-7">
          <Card>
            <CardHeader>
              <CardTitle>Assigned agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {agent ? (
                <>
                  <p className="font-medium">{agent.name}</p>
                  <a
                    className="flex items-center gap-2 break-all text-primary"
                    href={`mailto:${agent.email}`}
                  >
                    <Mail className="size-4 shrink-0" />
                    {agent.email}
                  </a>
                  {agent.phone && (
                    <a
                      className="flex items-center gap-2 text-primary"
                      href={`tel:${agent.phone}`}
                    >
                      <Phone className="size-4" />
                      {agent.phone}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  An agent has not been assigned yet. Contact the agent who sent
                  your portal invitation if you need immediate help.
                </p>
              )}
              {staff && (
                <p className="text-xs text-muted-foreground">
                  Policyholder: {claim.policyholderName} ·{" "}
                  {claim.policyholderEmail}
                  {claim.contactPhone ? ` · ${claim.contactPhone}` : ""}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {progress.map((step) => (
                <div key={step.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${step.isCompleted ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {step.isCompleted ? (
                      <Check className="size-3" />
                    ) : (
                      <span className="text-xs">{step.stepOrder}</span>
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
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
          <Card>
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
          {staff && !demo && (
            <StatusEditor
              key={`${claim.id}:${claim.version}`}
              claimId={claim.id}
              claimNumber={claim.claimNumber}
              currentStatus={claim.status as ClaimStatus}
              role={role}
            />
          )}
          {staff && (canAssess || claim.assessmentSummary) && (
            <Card>
              <CardHeader>
                <CardTitle>Assessment</CardTitle>
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
                {!canAssess && claim.estimatedLossAmount && (
                  <p className="text-sm">
                    Estimated loss: KES {claim.estimatedLossAmount}
                  </p>
                )}
                {canAssess && (
                  <>
                    <Label htmlFor="loss-estimate">
                      Estimated loss (KES, optional)
                    </Label>
                    <Input
                      id="loss-estimate"
                      disabled={disabled}
                      inputMode="decimal"
                      value={lossEstimate}
                      onChange={(e) => setLossEstimate(e.target.value)}
                      maxLength={20}
                    />
                    <TextAction
                      id="assessment-summary"
                      title="Record or revise assessment"
                      label="Explain the evidence, review and remaining uncertainties"
                      button="Save assessment"
                      minLength={20}
                      disabled={disabled}
                      onSubmit={(text) =>
                        recordClaimAssessment(claim.id, {
                          summary: text,
                          estimatedLossAmount: lossEstimate,
                        })
                      }
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}
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
        </aside>
      </div>
    </div>
  );
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
    <div className="space-y-3 rounded-lg border p-3">
      <p className="break-all text-sm font-medium">{doc.name}</p>
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
        disabled={disabled || doc.uploadState === "uploading"}
        onSubmit={(text) =>
          reviewClaimAttachment(doc.id, { status, note: text })
        }
      />
    </div>
  );
}
