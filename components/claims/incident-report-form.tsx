"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Car,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { FieldSet, FieldLegend, FieldError } from "@/components/ui/field";
import { DocumentUploader, type DocumentUploads } from "./document-uploader";
import { ReportField, ReportSelect, ANSWER_OPTIONS } from "./report-fields";
import {
  MOTOR_EVIDENCE_CATEGORIES,
  burglaryEvidenceCategories,
} from "./evidence-categories";
import { useClaimDraft, type ResumableClaimDraft } from "./use-claim-draft";
import {
  blankMotorClaim,
  blankBurglaryClaim,
  blankLossItem,
  motorClaimSchema,
  burglaryClaimSchema,
  motorClaimDraftSchema,
  burglaryClaimDraftSchema,
  reportingToday,
  moneyToMinorUnits,
  type ClaimFormData,
  type MotorClaimFormData,
  type BurglaryClaimFormData,
  type LossItem,
} from "@/lib/schemas/claim-forms";
import {
  submitMotorClaim,
  submitBurglaryClaim,
} from "@/app/actions/user/submit-claim";
import {
  uploadClaimDocuments,
  type UploadProgress,
} from "@/lib/upload-claim-documents";
import type { EvidenceCategory } from "@/lib/claim-evidence";
import { getPotentialDuplicateClaims } from "@/app/actions/user/my-claims";
import { cn } from "@/lib/utils";

export interface ClaimPolicyContext {
  policyNumber: string;
  organizationName: string;
  insuredAsset?: string | null;
  coverageSummary?: string | null;
  source?: string | null;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  status?: string | null;
  policyholderName?: string | null;
  policyholderPhone?: string | null;
}
export interface IncidentReportFormProps {
  policyId?: string;
  policyContext?: ClaimPolicyContext;
  initialDraft?: ResumableClaimDraft;
  initialClaimId?: string;
  demo?: boolean;
}
type FormKey = keyof MotorClaimFormData | keyof BurglaryClaimFormData;
const STEPS = [
  "Incident & contact",
  "Follow-up details",
  "Available evidence",
  "Review & report",
];
const INCIDENT_KEYS = new Set([
  "incidentType",
  "registrationNumber",
  "premisesLocation",
  "premisesUse",
  "incidentTiming",
  "incidentDate",
  "incidentTime",
  "incidentRangeStart",
  "incidentRangeEnd",
  "discoveryDate",
  "discoveryTime",
  "incidentLocation",
  "description",
  "contactPhone",
]);
function stepForField(path: string) {
  const first = path.split(".")[0];
  return INCIDENT_KEYS.has(first)
    ? 0
    : first === "pendingEvidence"
      ? 2
      : first === "declarationAccepted" || first === "privacyAccepted"
        ? 3
        : 1;
}

export function IncidentReportForm({
  policyType,
  policyId,
  policyContext,
  initialDraft,
  initialClaimId,
  demo = false,
}: IncidentReportFormProps & { policyType: "motor" | "burglary" }) {
  const prefix = useId();
  const [form, setForm] = useState<ClaimFormData>(() => {
    const schema =
      policyType === "motor" ? motorClaimDraftSchema : burglaryClaimDraftSchema;
    const parsed = schema.safeParse(initialDraft?.formData ?? {});
    const base = parsed.success
      ? parsed.data
      : policyType === "motor"
        ? blankMotorClaim()
        : blankBurglaryClaim();
    if (initialDraft) return base;
    return policyType === "burglary"
      ? ({
          ...base,
          premisesLocation: policyContext?.insuredAsset || "",
          contactPhone: policyContext?.policyholderPhone || "",
        } as BurglaryClaimFormData)
      : { ...base, contactPhone: policyContext?.policyholderPhone || "" };
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<DocumentUploads>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; claimNumber: string }>
  >([]);
  const [duplicateDate, setDuplicateDate] = useState("");
  const [receipt, setReceipt] = useState<{
    claimId: string;
    claimNumber: string;
    organizationId: string;
  }>();
  const motor = "incidentType" in form ? form : undefined;
  const burglary = "premisesLocation" in form ? form : undefined;
  const categories =
    policyType === "motor"
      ? MOTOR_EVIDENCE_CATEGORIES.filter(
          (category) =>
            (motor?.incidentType === "accident" || category.key !== "driving_license") &&
            (motor?.incidentType !== "theft" || category.key !== "repair_estimate"),
        )
      : burglaryEvidenceCategories(burglary?.premisesUse);
  const allFiles = Object.values(uploads).flat();
  const persistedData = useMemo(() => {
    const entries = Object.entries(uploads).flatMap(([category, files]) =>
      files.map((file) => ({ category, file })),
    );
    return {
      ...form,
      pendingEvidence: [
        ...form.pendingEvidence.filter(
          (previous) =>
            !entries.some(
              ({ category, file }) =>
                previous.clientUploadId === file.id ||
                (previous.category === category &&
                  previous.name === file.name &&
                  previous.size === file.size),
            ),
        ),
        ...entries
          .filter(({ file }) => file.status !== "uploaded")
          .map(({ category, file }) => ({
            clientUploadId: file.id,
            name: file.name,
            size: file.size,
            category: category as EvidenceCategory,
            ...(file.lossItemId ? { lossItemId: file.lossItemId } : {}),
          })),
      ],
    };
  }, [form, uploads]);
  const draft = useClaimDraft({
    policyId,
    policyType,
    formData: persistedData,
    initialDraft,
    initialClaimId,
    paused: submitting,
    hasLocalFiles: allFiles.some((file) => file.status !== "uploaded"),
    demo,
  });
  const idFor = (key: string) => `${prefix}-${key.replaceAll(".", "-")}`;
  const valueFor = (key: FormKey) =>
    String((form as unknown as Record<string, unknown>)[key] ?? "");
  const incidentDateForMatch =
    form.incidentDate || form.incidentRangeStart || form.discoveryDate;
  useEffect(() => {
    if (demo || !policyId || !incidentDateForMatch) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void getPotentialDuplicateClaims(policyId, incidentDateForMatch)
        .then((rows) => {
          if (!cancelled) {
            setDuplicates(rows);
            setDuplicateDate(incidentDateForMatch);
          }
        })
        .catch(() => {
          if (!cancelled) setDuplicates([]);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [demo, policyId, incidentDateForMatch]);

  function update(key: FormKey, value: unknown) {
    setForm((previous) => ({ ...previous, [key]: value }) as ClaimFormData);
    setErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([path]) => path !== key && !path.startsWith(`${key}.`),
        ),
      ),
    );
    setSubmitError(undefined);
  }
  function changeUploads(next: DocumentUploads) {
    setUploads(
      Object.fromEntries(
        Object.entries(next).map(([category, files]) => [
          category,
          files.map((file) => {
            const previous = form.pendingEvidence.find(
              (candidate) =>
                candidate.category === category &&
                candidate.name === file.name &&
                candidate.size === file.size,
            );
            return previous
              ? {
                  ...file,
                  id: previous.clientUploadId,
                  lossItemId: file.lossItemId ?? previous.lossItemId,
                }
              : file;
          }),
        ]),
      ),
    );
  }
  function progress(update: UploadProgress) {
    setUploads((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([category, files]) => [
          category,
          files.map((file) =>
            file.id === update.fileId ? { ...file, ...update } : file,
          ),
        ]),
      ),
    );
  }
  async function uploadFiles(
    saved: NonNullable<typeof receipt>,
    fileIds?: string[],
  ) {
    if (demo || uploading) return;
    setUploading(true);
    try {
      await uploadClaimDocuments(saved.claimId, saved.organizationId, uploads, {
        onProgress: progress,
        fileIds,
      });
    } catch {
      setSubmitError(
        "Your report is received. Document upload was interrupted; retry your files or add them from the claim page.",
      );
    } finally {
      setUploading(false);
    }
  }
  function field(
    key: FormKey,
    label: string,
    options: Partial<React.ComponentProps<typeof ReportField>> = {},
  ) {
    return (
      <ReportField
        {...options}
        id={idFor(key)}
        label={label}
        value={valueFor(key)}
        onChange={(value) => update(key, value)}
        error={errors[key]}
      />
    );
  }
  function select(
    key: FormKey,
    label: string,
    options: Array<[string, string]>,
    onChange?: (value: string) => void,
  ) {
    return (
      <ReportSelect
        id={idFor(key)}
        label={label}
        value={valueFor(key)}
        options={options}
        error={errors[key]}
        onChange={onChange || ((value) => update(key, value))}
      />
    );
  }
  function validate(throughStep = 3) {
    const parsed = (
      policyType === "motor" ? motorClaimSchema : burglaryClaimSchema
    ).safeParse(persistedData);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const relevant = parsed.error.issues.filter(
      (issue) => stepForField(issue.path.join(".")) <= throughStep,
    );
    if (!relevant.length) {
      setErrors({});
      return true;
    }
    const next = Object.fromEntries(
      relevant.map((issue) => [issue.path.join("."), issue.message]),
    );
    setErrors(next);
    const first = relevant[0].path.join(".");
    setStep(stepForField(first));
    window.setTimeout(() => document.getElementById(idFor(first))?.focus(), 0);
    return false;
  }
  async function submit() {
    setSubmitError(undefined);
    if (!validate()) return;
    if (demo) {
      setSubmitError(
        "Preview complete. This demonstration does not send a report, upload documents or save data to the server.",
      );
      return;
    }
    if (!policyId) {
      setSubmitError("Select an enrolled policy before reporting an incident.");
      return;
    }
    setSubmitting(true);
    try {
      const saved = await draft.saveNow();
      if (!saved.success || !saved.claimId) {
        setSubmitError(
          saved.error ||
            "Save the draft successfully before reporting. Your entries remain on this page.",
        );
        return;
      }
      const result =
        policyType === "motor"
          ? await submitMotorClaim({
              ...motorClaimSchema.parse(persistedData),
              policyId,
              claimId: saved.claimId,
            })
          : await submitBurglaryClaim({
              ...burglaryClaimSchema.parse(persistedData),
              policyId,
              claimId: saved.claimId,
            });
      if (!result.success) {
        setSubmitError(
          result.error ||
            "Your report could not be submitted. Retry using the same saved draft.",
        );
        return;
      }
      const received = {
        claimId: result.claimId,
        claimNumber: result.claimNumber,
        organizationId: result.organizationId,
      };
      setReceipt(received);
      draft.markSubmitted();
      await uploadFiles(received);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Connection interrupted. Retry with your existing saved draft.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt)
    return (
      <Card>
        <CardHeader>
          <CheckCircle2
            className="h-10 w-10 text-emerald-600"
            aria-hidden="true"
          />
          <CardTitle>Incident report received</CardTitle>
          <CardDescription>
            Your report is saved. Your agent will review it and explain any
            supporting information needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs leading-5 text-muted-foreground">
              Your claim reference
            </p>
            <p className="mt-1 break-all font-mono text-lg font-semibold">
              {receipt.claimNumber}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This receipt confirms the portal recorded your incident. Coverage
              and any insurer outcome are still subject to review.
            </p>
          </div>
          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
          <p role="status" className="text-sm">
            {uploading
              ? "Your report is received. Supporting files are uploading below."
              : allFiles.some((file) => file.status !== "uploaded")
                ? "Your report is received; some documents still need uploading. Retry individual files below or add them later from the claim page."
                : "You can return to the claim page to add evidence, read updates or contact your agent."}
          </p>
          {allFiles.length > 0 && (
            <DocumentUploader
              categories={categories.filter(
                (category) => uploads[category.key]?.length,
              )}
              uploads={uploads}
              onUploadsChange={changeUploads}
              onRetry={(fileId) => {
                void uploadFiles(receipt, [fileId]);
              }}
              disabled={uploading}
              lossItems={burglary?.lossItems}
            />
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/claims/${receipt.claimId}`}>View claim</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/claims/${receipt.claimId}#add-evidence`}>
                Add documents later
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/claim-forms">Report another incident</Link>
            </Button>
          </div>
          {allFiles.some((file) => file.status === "selected") && (
            <Button
              type="button"
              disabled={uploading}
              onClick={() => {
                void uploadFiles(receipt);
              }}
            >
              Upload selected files
            </Button>
          )}
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl [&>svg]:size-10 [&>svg]:rounded-xl [&>svg]:bg-primary/10 [&>svg]:p-2.5 [&>svg]:text-primary">
          {policyType === "motor" ? (
            <Car aria-hidden="true" />
          ) : (
            <Building2 aria-hidden="true" />
          )}
          {policyType === "motor" ? "Motor" : "Burglary"} incident report
        </CardTitle>
        <CardDescription>
          Report now with the details you know. Police information, loss
          estimates and documents can follow later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {demo && (
          <p className="rounded-lg border bg-muted p-3 text-sm">
            Form preview • Drafts stay in this page. Reports and files are never
            sent.
          </p>
        )}
        {policyContext && (
          <div className="rounded-xl border bg-muted/25 p-4 text-sm leading-6">
            <p className="font-medium">
              Policy {policyContext.policyNumber} ·{" "}
              {policyContext.organizationName}
            </p>
            {policyContext.policyholderName && (
              <p>
                Assisted report for {policyContext.policyholderName}. Your
                account is recorded as the person filing it.
              </p>
            )}
            {policyContext.insuredAsset && (
              <p className="portal-intro">
                Insured asset: {policyContext.insuredAsset}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {policyContext.source === "demo"
                ? "Demo policy profile"
                : "Manually recorded policy profile"}
              {policyContext.coverageStart && policyContext.coverageEnd
                ? ` · Recorded dates ${policyContext.coverageStart} to ${policyContext.coverageEnd}`
                : " · Coverage dates not yet recorded"}
              . Your agent will check the applicable coverage.
            </p>
            {policyContext.coverageSummary && (
              <p className="mt-1 text-xs text-muted-foreground">
                {policyContext.coverageSummary}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-xs">
          <p role="status" aria-live="polite" className="text-muted-foreground">
            {draft.isSaving
              ? "Saving draft…"
              : draft.isDirty
                ? "Changes waiting to save"
                : draft.savedAt
                  ? `${demo ? "Preview updated" : "Draft saved"} ${new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(draft.savedAt))} EAT`
                  : "A draft will save when you start entering details"}
            {draft.claimNumber ? ` · ${draft.claimNumber}` : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={submitting || draft.isSaving}
            onClick={() => {
              void draft.saveNow();
            }}
          >
            <Save aria-hidden="true" />
            Save draft
          </Button>
        </div>
        {draft.saveError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
          >
            {draft.saveError} Your entries remain on this page.
          </div>
        )}
        {duplicateDate === incidentDateForMatch && duplicates.length > 0 && (
          <p
            role="status"
            className="rounded-lg border border-amber-300/70 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10 p-3 text-sm leading-6 text-amber-950 dark:text-amber-200"
          >
            A report for this policy has the same incident date:{" "}
            {duplicates.map((c) => c.claimNumber).join(", ")}. If this is the
            same incident, open the existing claim or contact your agent before
            reporting again.
          </p>
        )}
        <nav
          aria-label="Incident report steps"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {STEPS.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-current={index === step ? "step" : undefined}
              onClick={() => {
                if (index <= step || validate(index - 1)) {
                  setStep(index);
                  setErrors({});
                }
              }}
              disabled={submitting}
              className={cn(
                "min-h-16 rounded-xl border px-3 py-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === step
                  ? "border-primary/40 bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="mb-1 block text-[10px] uppercase tracking-wider opacity-75">Step {index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            if (step < 3) {
              if (validate(step)) setStep(step + 1);
            } else void submit();
          }}
        >
          <fieldset disabled={submitting} className="space-y-5">
            <legend className="sr-only">{STEPS[step]}</legend>
            {Object.keys(errors).length > 0 && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
              >
                Please check the highlighted fields before continuing.
              </p>
            )}
            {step === 0 && (
              <FieldSet>
                <FieldLegend>What happened?</FieldLegend>
                <p className="text-xs leading-5 text-muted-foreground">
                  If anyone is injured or in immediate danger, contact local
                  emergency services first. Use local incident dates and times
                  (East Africa Time). Leave optional times blank if unknown.
                </p>
                {motor && (
                  <>
                    {select(
                      "incidentType",
                      "Type of motor incident",
                      [
                        ["accident", "Accident"],
                        ["theft", "Vehicle theft"],
                        ["other_damage", "Other vehicle damage"],
                      ],
                      (value) => {
                        setForm(
                          (previous) =>
                            ({
                              ...previous,
                              incidentType: value,
                              driverFullName: "",
                              licenseNumber: "",
                              yearsOfExperience: "",
                              relationshipToPolicyholder: "",
                              weatherConditions: "",
                              estimatedSpeed: "",
                              thirdParties: [],
                              thirdPartyRegistration: "",
                              thirdPartyInjuries: "",
                              injuries: "unknown",
                              isVehicleDrivable: "unknown",
                              ...(value === "theft" ? { damageSummary: "", repairEstimateStatus: "not_yet" } : {}),
                              pendingEvidence: previous.pendingEvidence.filter(file =>
                                (value === "accident" || file.category !== "driving_license") &&
                                (value !== "theft" || file.category !== "repair_estimate")),
                            }) as MotorClaimFormData,
                        );
                        setUploads(previous => Object.fromEntries(Object.entries(previous).filter(([category]) =>
                          (value === "accident" || category !== "driving_license") &&
                          (value !== "theft" || category !== "repair_estimate"))));
                        setErrors({});
                      },
                    )}
                    {field(
                      "registrationNumber",
                      "Insured vehicle registration *",
                      {
                        maxLength: 20,
                        autoComplete: "off",
                        placeholder: "e.g. KDA 123A",
                      },
                    )}
                    {field(
                      "incidentLocation",
                      "Incident or discovery location *",
                      {
                        maxLength: 500,
                        placeholder:
                          "Road, town, parking area or last known location",
                      },
                    )}
                  </>
                )}
                {burglary && (
                  <>
                    {field(
                      "premisesLocation",
                      "Premises address / location *",
                      { maxLength: 500, autoComplete: "street-address" },
                    )}
                    {select(
                      "premisesUse",
                      "How are the premises used?",
                      [
                        ["unknown", "Not known yet"],
                        ["residential", "Residential"],
                        ["business", "Business"],
                      ],
                      (value) => {
                        setForm(
                          (previous) =>
                            ({
                              ...previous,
                              premisesUse: value,
                              pendingEvidence:
                                value === "business"
                                  ? previous.pendingEvidence
                                  : previous.pendingEvidence.filter(
                                      (file) =>
                                        file.category !== "stock_records",
                                    ),
                            }) as BurglaryClaimFormData,
                        );
                        setErrors({});
                        if (value !== "business")
                          setUploads((previous) => ({
                            ...previous,
                            stock_records: [],
                          }));
                      },
                    )}
                  </>
                )}
                {select(
                  "incidentTiming",
                  "Do you know when the incident happened?",
                  [
                    [
                      "unknown",
                      "Incident time unknown — report discovery date",
                    ],
                    ["exact", "I know the incident date"],
                    ["approximate", "I know an approximate date range"],
                  ],
                  (value) => {
                    setForm(
                      (previous) =>
                        ({
                          ...previous,
                          incidentTiming: value,
                          incidentDate: "",
                          incidentTime: "",
                          incidentRangeStart: "",
                          incidentRangeEnd: "",
                        }) as ClaimFormData,
                    );
                    setErrors({});
                  },
                )}
                {form.incidentTiming === "exact" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("incidentDate", "Incident date *", {
                      type: "date",
                      max: reportingToday(),
                      min: "1900-01-01",
                      maxLength: 10,
                    })}
                    {field("incidentTime", "Incident time (optional)", {
                      type: "time",
                      maxLength: 5,
                      hint: "Leave blank if you do not know the time.",
                    })}
                  </div>
                )}
                {form.incidentTiming === "approximate" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field("incidentRangeStart", "Earliest possible date *", {
                      type: "date",
                      max: reportingToday(),
                      min: "1900-01-01",
                      maxLength: 10,
                    })}
                    {field("incidentRangeEnd", "Latest possible date *", {
                      type: "date",
                      max: reportingToday(),
                      min: "1900-01-01",
                      maxLength: 10,
                    })}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field(
                    "discoveryDate",
                    `Discovery date ${form.incidentTiming === "unknown" ? "*" : "(optional)"}`,
                    {
                      type: "date",
                      max: reportingToday(),
                      min: "1900-01-01",
                      maxLength: 10,
                    },
                  )}
                  {field("discoveryTime", "Discovery time (optional)", {
                    type: "time",
                    maxLength: 5,
                  })}
                </div>
                {field("description", "Describe the incident *", {
                  multiline: true,
                  maxLength: 5000,
                  hint: "Explain what happened and the broad damage or loss. At least 10 characters. Estimates and full supporting details can follow later.",
                })}
                {field("contactPhone", "Best contact phone number *", {
                  type: "tel",
                  autoComplete: "tel",
                  inputMode: "tel",
                  maxLength: 30,
                  placeholder: "+254 700 000 000",
                })}
              </FieldSet>
            )}
            {step === 1 && (
              <div className="space-y-6">
                <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  These follow-up details are optional. Add what you know now,
                  or continue to report the incident and supply them later.
                </p>
                {motor && (
                  <FieldSet>
                    <FieldLegend>
                      {motor.incidentType === "theft"
                        ? "Vehicle and theft details"
                        : "Vehicle and damage details"}
                    </FieldLegend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field("make", "Vehicle make", { maxLength: 50 })}
                      {field("model", "Vehicle model", { maxLength: 50 })}
                    </div>
                    {field("currentMileage", "Mileage (km)", {
                      inputMode: "decimal",
                      maxLength: 20,
                      hint: "Leave blank if unknown.",
                    })}
                    {field(
                      "vehicleCurrentLocation",
                      motor.incidentType === "theft"
                        ? "Last known vehicle location"
                        : "Where is the vehicle now?",
                      { maxLength: 500 },
                    )}
                    {motor.incidentType !== "theft" && (
                      <>
                        {select(
                          "isVehicleDrivable",
                          "Is the vehicle drivable?",
                          ANSWER_OPTIONS,
                        )}
                        {field("damageSummary", "Damage description", {
                          multiline: true,
                          maxLength: 5000,
                        })}
                        {select(
                          "repairEstimateStatus",
                          "Repair estimate availability",
                          [
                            ["not_yet", "Not available yet"],
                            ["available", "Available"],
                            ["unknown", "Not known yet"],
                          ],
                        )}
                      </>
                    )}
                    {motor.incidentType === "accident" && (
                      <>
                        <FieldLegend>Driver and people involved</FieldLegend>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {field("driverFullName", "Driver's name", {
                            maxLength: 100,
                          })}
                          {field("licenseNumber", "Driving licence number", {
                            maxLength: 50,
                          })}
                          {field(
                            "yearsOfExperience",
                            "Years of driving experience",
                            { maxLength: 10, inputMode: "decimal" },
                          )}
                          {field(
                            "relationshipToPolicyholder",
                            "Driver's relationship to policyholder",
                            { maxLength: 30 },
                          )}
                          {field("weatherConditions", "Weather conditions", {
                            maxLength: 30,
                          })}
                          {field("estimatedSpeed", "Estimated speed (km/h)", {
                            maxLength: 10,
                            inputMode: "decimal",
                            hint: "An estimate is fine; leave blank if unknown.",
                          })}
                        </div>
                        {select(
                          "injuries",
                          "Was anyone injured?",
                          ANSWER_OPTIONS,
                        )}
                        {motor.thirdParties.map((person, index) => (
                          <div
                            key={index}
                            className="space-y-3 rounded-lg border p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                Other person / vehicle {index + 1}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={`Remove other person or vehicle ${index + 1}`}
                                onClick={() =>
                                  update(
                                    "thirdParties",
                                    motor.thirdParties.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                              >
                                <Trash2 aria-hidden="true" />
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {(
                                [
                                  "name",
                                  "registrationNumber",
                                  "contactPhone",
                                  "injuryDetails",
                                ] as const
                              ).map((key) => (
                                <ReportField
                                  key={key}
                                  id={idFor(`thirdParties.${index}.${key}`)}
                                  label={
                                    {
                                      name: "Name",
                                      registrationNumber:
                                        "Vehicle registration",
                                      contactPhone: "Contact phone",
                                      injuryDetails: "Known injury details",
                                    }[key]
                                  }
                                  value={person[key]}
                                  maxLength={
                                    key === "injuryDetails"
                                      ? 1000
                                      : key === "name"
                                        ? 100
                                        : key === "contactPhone"
                                          ? 30
                                          : 50
                                  }
                                  type={key === "contactPhone" ? "tel" : "text"}
                                  error={errors[`thirdParties.${index}.${key}`]}
                                  onChange={(value) =>
                                    update(
                                      "thirdParties",
                                      motor.thirdParties.map(
                                        (existing, itemIndex) =>
                                          itemIndex === index
                                            ? { ...existing, [key]: value }
                                            : existing,
                                      ),
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={motor.thirdParties.length >= 20}
                          onClick={() =>
                            update("thirdParties", [
                              ...motor.thirdParties,
                              {
                                name: "",
                                registrationNumber: "",
                                contactPhone: "",
                                injuryDetails: "",
                              },
                            ])
                          }
                        >
                          <Plus aria-hidden="true" />
                          Add person or vehicle
                        </Button>
                      </>
                    )}
                    {field("witnesses", "Witness information", {
                      multiline: true,
                      maxLength: 1000,
                      hint: "Names and contact details only if you have them.",
                    })}
                  </FieldSet>
                )}
                {burglary && (
                  <>
                    <FieldSet>
                      <FieldLegend>Premises, entry and security</FieldLegend>
                      {select("buildingType", "Building type", [
                        ["", "Not known yet"],
                        ["apartment", "Apartment"],
                        ["townhouse", "Townhouse"],
                        ["bungalow", "Bungalow"],
                        ["office", "Office"],
                        ["shop", "Shop"],
                        ["warehouse", "Warehouse"],
                        ["other", "Other"],
                      ])}
                      {select(
                        "wasAnyoneHome",
                        "Was anyone at the premises?",
                        ANSWER_OPTIONS,
                      )}
                      {field("entryMethod", "How was entry made?", {
                        multiline: true,
                        maxLength: 1000,
                        hint: "Leave blank if not known yet.",
                      })}
                      {select(
                        "evidenceOfViolence",
                        "Visible damage or force at the entry point?",
                        ANSWER_OPTIONS,
                      )}
                      {field("premisesDamage", "Damage to the premises", {
                        multiline: true,
                        maxLength: 1000,
                      })}
                      {select(
                        "alarmFitted",
                        "Was an alarm fitted?",
                        ANSWER_OPTIONS,
                        (value) => {
                          setForm(
                            (previous) =>
                              ({
                                ...previous,
                                alarmFitted: value,
                                alarmActiveAtTime:
                                  value === "no" ? "n_a" : "unknown",
                              }) as BurglaryClaimFormData,
                          );
                          setErrors({});
                        },
                      )}
                      {burglary.alarmFitted === "yes" &&
                        select(
                          "alarmActiveAtTime",
                          "Was the alarm active?",
                          ANSWER_OPTIONS,
                        )}
                      {field(
                        "securityFirmName",
                        "Security firm (if applicable)",
                        { maxLength: 100 },
                      )}
                      {field("exteriorLockTypes", "Exterior door locks", {
                        maxLength: 1000,
                      })}
                    </FieldSet>
                    <LossInventory
                      form={burglary}
                      errors={errors}
                      idFor={idFor}
                      onChange={(items) => {
                        const keys = new Set(items.map((item) => item.itemKey));
                        setForm(
                          (previous) =>
                            ({
                              ...previous,
                              lossItems: items,
                              pendingEvidence: previous.pendingEvidence.map(
                                (file) =>
                                  file.lossItemId && !keys.has(file.lossItemId)
                                    ? { ...file, lossItemId: undefined }
                                    : file,
                              ),
                            }) as BurglaryClaimFormData,
                        );
                        setErrors({});
                        setUploads((previous) =>
                          Object.fromEntries(
                            Object.entries(previous).map(
                              ([category, files]) => [
                                category,
                                files.map((file) =>
                                  file.lossItemId && !keys.has(file.lossItemId)
                                    ? { ...file, lossItemId: undefined }
                                    : file,
                                ),
                              ],
                            ),
                          ),
                        );
                      }}
                    />
                  </>
                )}
                <FieldSet>
                  <FieldLegend>Police information</FieldLegend>
                  {select(
                    "policeReportStatus",
                    "Has the incident been reported to police?",
                    [
                      ["not_yet", "Not yet — I will add details later"],
                      ["reported", "Reported"],
                      ["unknown", "Not known yet"],
                    ],
                    (value) => {
                      setForm(
                        (previous) =>
                          ({
                            ...previous,
                            policeReportStatus: value,
                            policeStation: "",
                            obNumber: "",
                            ...("reportingOfficer" in previous
                              ? { reportingOfficer: "" }
                              : { dateReported: "" }),
                          }) as ClaimFormData,
                      );
                      setErrors({});
                    },
                  )}
                  {form.policeReportStatus === "reported" && (
                    <>
                      {field("policeStation", "Police station", {
                        maxLength: 100,
                        hint: "Reporting details can be supplied later if unavailable.",
                      })}
                      {field("obNumber", "O.B. / report reference", {
                        maxLength: 50,
                      })}
                      {motor &&
                        field(
                          "reportingOfficer",
                          "Reporting officer (if known)",
                          { maxLength: 100 },
                        )}
                      {burglary &&
                        field("dateReported", "Date reported", {
                          type: "date",
                          max: reportingToday(),
                          min: "1900-01-01",
                          maxLength: 10,
                        })}
                    </>
                  )}
                </FieldSet>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                {form.pendingEvidence.filter(
                  (previous) =>
                    !allFiles.some(
                      (file) => file.id === previous.clientUploadId,
                    ),
                ).length > 0 && (
                  <div className="rounded-xl border bg-muted/25 p-4 text-sm leading-6">
                    <p className="font-medium">
                      Please reselect files from your device
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The draft saved the filenames below. Files selected before
                      a refresh are not uploaded or retained by the browser.
                      Reselect them now, or add them after reporting.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {form.pendingEvidence
                        .filter(
                          (previous) =>
                            !allFiles.some(
                              (file) => file.id === previous.clientUploadId,
                            ),
                        )
                        .map((previous) => (
                          <li
                            key={previous.clientUploadId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="break-all text-xs">
                              {previous.name}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Remove reminder for ${previous.name}`}
                              onClick={() =>
                                update(
                                  "pendingEvidence",
                                  form.pendingEvidence.filter(
                                    (file) =>
                                      file.clientUploadId !==
                                      previous.clientUploadId,
                                  ),
                                )
                              }
                            >
                              Remove reminder
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                <DocumentUploader
                  categories={categories}
                  uploads={uploads}
                  onUploadsChange={changeUploads}
                  disabled={submitting}
                  lossItems={burglary?.lossItems}
                />
              </div>
            )}
            {step === 3 && (
              <div className="space-y-5">
                <ReportReview
                  form={form}
                  uploads={uploads}
                  onEdit={(index) => {
                    setStep(index);
                    setErrors({});
                  }}
                />
                <FieldSet>
                  <FieldLegend>Confirm before reporting</FieldLegend>
                  <label
                    htmlFor={idFor("declarationAccepted")}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <input
                      id={idFor("declarationAccepted")}
                      type="checkbox"
                      checked={form.declarationAccepted}
                      onChange={(event) =>
                        update("declarationAccepted", event.target.checked)
                      }
                      aria-invalid={!!errors.declarationAccepted}
                      aria-describedby={
                        errors.declarationAccepted
                          ? `${idFor("declarationAccepted")}-error`
                          : undefined
                      }
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>
                      I confirm this report is accurate to the best of my
                      knowledge. I have identified unknown information and will
                      update it when available.
                    </span>
                  </label>
                  <FieldError id={`${idFor("declarationAccepted")}-error`}>
                    {errors.declarationAccepted}
                  </FieldError>
                  <label
                    htmlFor={idFor("privacyAccepted")}
                    className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                  >
                    <input
                      id={idFor("privacyAccepted")}
                      type="checkbox"
                      checked={form.privacyAccepted}
                      onChange={(event) =>
                        update("privacyAccepted", event.target.checked)
                      }
                      aria-invalid={!!errors.privacyAccepted}
                      aria-describedby={
                        errors.privacyAccepted
                          ? `${idFor("privacyAccepted")}-error`
                          : undefined
                      }
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>
                      I understand that the portal operator and authorized
                      claims staff will use my report, contact details and
                      documents to manage this claim.{" "}
                      <Link href="/privacy" className="text-primary underline">
                        Read the privacy notice.
                      </Link>
                    </span>
                  </label>
                  <FieldError id={`${idFor("privacyAccepted")}-error`}>
                    {errors.privacyAccepted}
                  </FieldError>
                </FieldSet>
              </div>
            )}
            {submitError && (
              <p
                role="alert"
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  demo ? "bg-muted" : "border-destructive/30 text-destructive",
                )}
              >
                {submitError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || submitting}
                onClick={() => {
                  setStep(step - 1);
                  setErrors({});
                }}
              >
                <ChevronLeft aria-hidden="true" />
                Back
              </Button>
              <span className="text-xs leading-5 text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              <Button
                type="submit"
                disabled={submitting || (!policyId && !demo)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Reporting…
                  </>
                ) : step === 3 ? (
                  demo ? (
                    "Validate preview"
                  ) : (
                    "Report incident"
                  )
                ) : (
                  <>
                    {step === 1 || step === 2
                      ? "Continue (details optional)"
                      : "Continue"}
                    <ChevronRight aria-hidden="true" />
                  </>
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function LossInventory({
  form,
  errors,
  idFor,
  onChange,
}: {
  form: BurglaryClaimFormData;
  errors: Record<string, string>;
  idFor: (key: string) => string;
  onChange: (items: LossItem[]) => void;
}) {
  function update(index: number, key: keyof LossItem, value: unknown) {
    onChange(
      form.lossItems.map((item, itemIndex) =>
        itemIndex === index ? ({ ...item, [key]: value } as LossItem) : item,
      ),
    );
  }
  const knownTotal = form.lossItems.reduce(
    (sum, item) =>
      sum +
      BigInt(moneyToMinorUnits(item.replacementValue) ?? 0) *
        BigInt(
          Number.isInteger(item.quantity) && item.quantity > 0
            ? item.quantity
            : 0,
        ),
    BigInt(0),
  );
  const totalText = `${(knownTotal / BigInt(100)).toLocaleString("en-KE")}.${(knownTotal % BigInt(100)).toString().padStart(2, "0")}`;
  return (
    <FieldSet>
      <FieldLegend>Loss inventory (optional for reporting)</FieldLegend>
      <p className="text-xs leading-5 text-muted-foreground">
        List known stolen items now or add them later. Estimates are per unit;
        quantity is included in the total. Unknown values can stay blank.
      </p>
      {form.lossItems.map((item, index) => (
        <div key={item.itemKey} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Loss item {index + 1}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Remove loss item ${index + 1}`}
              onClick={() =>
                onChange(
                  form.lossItems.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          </div>
          <ReportField
            id={idFor(`lossItems.${index}.description`)}
            label="Item description"
            value={item.description}
            maxLength={500}
            error={errors[`lossItems.${index}.description`]}
            onChange={(value) => update(index, "description", value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ReportField
              id={idFor(`lossItems.${index}.quantity`)}
              label="Quantity"
              value={String(item.quantity)}
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              error={errors[`lossItems.${index}.quantity`]}
              onChange={(value) =>
                update(index, "quantity", value ? Number(value) : 1)
              }
            />
            <ReportField
              id={idFor(`lossItems.${index}.identifyingDetails`)}
              label="Make, model, serial number or other identifying details"
              value={item.identifyingDetails}
              maxLength={500}
              error={errors[`lossItems.${index}.identifyingDetails`]}
              onChange={(value) => update(index, "identifyingDetails", value)}
            />
            <ReportField
              id={idFor(`lossItems.${index}.purchaseDate`)}
              label="Purchase date (if known)"
              value={item.purchaseDate}
              type="date"
              max={reportingToday()}
              min="1900-01-01"
              error={errors[`lossItems.${index}.purchaseDate`]}
              onChange={(value) => update(index, "purchaseDate", value)}
            />
            <label
              htmlFor={idFor(`lossItems.${index}.purchaseDateApproximate`)}
              className="flex items-center gap-2 text-sm"
            >
              <input
                id={idFor(`lossItems.${index}.purchaseDateApproximate`)}
                type="checkbox"
                className="size-4 accent-primary"
                checked={item.purchaseDateApproximate}
                onChange={(event) =>
                  update(index, "purchaseDateApproximate", event.target.checked)
                }
              />
              Purchase date is approximate
            </label>
            {(["originalCost", "replacementValue"] as const).map((key) => (
              <ReportField
                key={key}
                id={idFor(`lossItems.${index}.${key}`)}
                label={
                  key === "originalCost"
                    ? "Original cost per unit (KES)"
                    : "Estimated replacement cost per unit (KES)"
                }
                value={item[key]}
                inputMode="decimal"
                maxLength={20}
                error={errors[`lossItems.${index}.${key}`]}
                hint="Leave blank if unknown. Up to two decimal places."
                onChange={(value) => update(index, key, value)}
              />
            ))}
          </div>
          <ReportSelect
            id={idFor(`lossItems.${index}.ownershipEvidence`)}
            label="Available ownership evidence"
            value={item.ownershipEvidence}
            options={[
              ["unknown", "Not known yet"],
              ["receipt", "Purchase receipt"],
              ["valuation", "Valuation"],
              [
                "alternative",
                "Alternative evidence (bank statement, photos, other)",
              ],
              ["not_available", "Not available yet"],
            ]}
            onChange={(value) => update(index, "ownershipEvidence", value)}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={form.lossItems.length >= 100}
        onClick={() => onChange([...form.lossItems, blankLossItem()])}
      >
        <Plus aria-hidden="true" />
        Add loss item
      </Button>
      {form.lossItems.length > 0 && (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Known estimated replacement cost: <strong>KES {totalText}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            Items with unknown or invalid amounts are excluded. This estimate is
            not an approved settlement.
          </span>
        </p>
      )}
    </FieldSet>
  );
}

const REVIEW_LABELS: Record<string, string> = {
  incidentType: "Incident type",
  registrationNumber: "Vehicle registration",
  make: "Vehicle make",
  model: "Vehicle model",
  currentMileage: "Mileage (km)",
  driverFullName: "Driver",
  licenseNumber: "Driving licence",
  yearsOfExperience: "Driving experience (years)",
  relationshipToPolicyholder: "Relationship to policyholder",
  incidentTiming: "Timing certainty",
  incidentDate: "Incident date",
  incidentTime: "Incident time (EAT)",
  incidentRangeStart: "Earliest possible date",
  incidentRangeEnd: "Latest possible date",
  discoveryDate: "Discovery date",
  discoveryTime: "Discovery time (EAT)",
  incidentLocation: "Incident location",
  weatherConditions: "Weather",
  estimatedSpeed: "Estimated speed (km/h)",
  description: "Incident description",
  contactPhone: "Contact phone",
  policeReportStatus: "Police reporting",
  policeStation: "Police station",
  obNumber: "Police reference",
  reportingOfficer: "Reporting officer",
  damageSummary: "Damage",
  isVehicleDrivable: "Vehicle drivable",
  vehicleCurrentLocation: "Current / last known vehicle location",
  injuries: "Injuries",
  witnesses: "Witnesses",
  repairEstimateStatus: "Repair estimate",
  premisesLocation: "Premises location",
  premisesUse: "Premises use",
  buildingType: "Building type",
  wasAnyoneHome: "Anyone at premises",
  entryMethod: "Entry circumstances",
  evidenceOfViolence: "Visible force or damage",
  alarmFitted: "Alarm fitted",
  alarmActiveAtTime: "Alarm active",
  securityFirmName: "Security firm",
  exteriorLockTypes: "Exterior locks",
  dateReported: "Police reporting date",
  premisesDamage: "Premises damage",
};
const VALUE_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  unknown: "Not known yet",
  n_a: "Not applicable",
  not_yet: "Not available / not done yet",
  reported: "Reported",
  available: "Available",
  accident: "Accident",
  theft: "Vehicle theft",
  other_damage: "Other vehicle damage",
  exact: "Known date",
  approximate: "Approximate range",
  residential: "Residential",
  business: "Business",
};
function ReportReview({
  form,
  uploads,
  onEdit,
}: {
  form: ClaimFormData;
  uploads: DocumentUploads;
  onEdit: (step: number) => void;
}) {
  const rows = Object.entries(form).filter(
    ([key, value]) =>
      REVIEW_LABELS[key] && typeof value === "string" && value !== "",
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Review your report</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(0)}
        >
          Edit incident
        </Button>
      </div>
      <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className={key === "description" ? "sm:col-span-2" : ""}
          >
            <dt className="text-xs leading-5 text-muted-foreground">
              {REVIEW_LABELS[key]}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
              {VALUE_LABELS[String(value)] || String(value)}
            </dd>
          </div>
        ))}
      </dl>
      {"thirdParties" in form && form.thirdParties.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <h4 className="font-medium">Other people / vehicles</h4>
          <ul className="mt-2 space-y-2">
            {form.thirdParties.map((person, index) => (
              <li key={index}>
                {index + 1}. {person.name || "Name not known"} ·{" "}
                {person.registrationNumber || "Registration not known"} ·{" "}
                {person.contactPhone || "Contact not known"}
                {person.injuryDetails ? ` · ${person.injuryDetails}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {"lossItems" in form && form.lossItems.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <h4 className="font-medium">Loss inventory</h4>
          <ul className="mt-2 space-y-2">
            {form.lossItems.map((item) => (
              <li key={item.itemKey} className="break-words">
                {item.quantity} × {item.description || "Description missing"}
                {item.identifyingDetails
                  ? ` · ${item.identifyingDetails}`
                  : ""}{" "}
                ·{" "}
                {item.replacementValue
                  ? `Estimated KES ${item.replacementValue} per unit`
                  : "Value not known yet"}
                {item.originalCost
                  ? ` · Original KES ${item.originalCost} per unit`
                  : ""}
                {item.purchaseDate
                  ? ` · Purchased ${item.purchaseDate}${item.purchaseDateApproximate ? " (approximate)" : ""}`
                  : ""}{" "}
                · Ownership evidence:{" "}
                {item.ownershipEvidence.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(1)}
        >
          Edit follow-up details
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(2)}
        >
          Edit evidence
        </Button>
      </div>
      <div className="rounded-xl border bg-muted/25 p-4 text-sm leading-6">
        <p>
          {Object.values(uploads).flat().length} files selected for upload after
          your report is received.
        </p>
        {Object.values(uploads).flat().length > 0 && (
          <ul className="mt-2 space-y-1">
            {Object.entries(uploads).flatMap(([category, files]) =>
              files.map((file) => (
                <li key={file.id} className="break-all text-xs">
                  {file.name} · {category.replaceAll("_", " ")}
                  {file.lossItemId ? " · Linked to inventory item" : ""}
                </li>
              )),
            )}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Missing police details, estimates and documents can be supplied later.
          No insurer approval or payment is implied by reporting.
        </p>
      </div>
    </div>
  );
}
