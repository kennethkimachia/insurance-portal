"use client";

import { useState } from "react";
import {
  burglaryClaimSchema,
  type BurglaryClaimFormData,
  type LossItem,
} from "@/lib/schemas/claim-forms";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  DocumentUploader,
  type DocumentCategory,
  type DocumentUploads,
} from "@/components/claims/document-uploader";
import {
  Building2,
  DoorOpen,
  ShieldCheck,
  ShieldAlert,
  PackageSearch,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step definitions ─────────────────────────────────────────────────────

const STEPS = [
  { key: "premises", label: "Premises", icon: Building2 },
  { key: "entry", label: "Entry Details", icon: DoorOpen },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "police", label: "Police Report", icon: ShieldAlert },
  { key: "inventory", label: "Loss Inventory", icon: PackageSearch },
  { key: "documents", label: "Documents", icon: Paperclip },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// ── Document categories for burglary claims ──────────────────────────────

const BURGLARY_DOC_CATEGORIES: DocumentCategory[] = [
  {
    key: "police_abstract",
    label: "Police Abstract",
    description:
      "Official document confirming the theft was reported and documented by authorities",
    required: true,
    accept: "image/*,.pdf",
    multiple: false,
  },
  {
    key: "purchase_receipts",
    label: "Purchase Receipts / Invoices / Valuations",
    description:
      "Original receipts, invoices, or valuation certificates for every major stolen item",
    required: true,
    accept: "image/*,.pdf",
    multiple: true,
  },
  {
    key: "bank_statements",
    label: "Bank / Credit Card Statements (if receipts lost)",
    description:
      "Transaction records as alternative proof of ownership for items without receipts",
    required: false,
    accept: "image/*,.pdf",
    multiple: true,
  },
  {
    key: "entry_photos",
    label: "Photos of Point of Entry",
    description:
      "Photographs of the broken window, tampered lock, or forced entry point",
    required: true,
    accept: "image/*",
    multiple: true,
  },
  {
    key: "security_report",
    label: "Security Firm Incident Report",
    description:
      "Report from the security firm or guards on duty (if premises was guarded)",
    required: false,
    accept: "image/*,.pdf",
    multiple: true,
  },
  {
    key: "stock_records",
    label: "Books of Accounts / Stock Records (business premises)",
    description:
      "Inventory levels and accounting records from just before the theft (for business premises)",
    required: false,
    accept: "image/*,.pdf,.xlsx,.csv",
    multiple: true,
  },
];

// ── Blank form ───────────────────────────────────────────────────────────

const BLANK_ITEM: LossItem = {
  description: "",
  purchaseDate: "",
  originalCost: "",
  replacementValue: "",
};

const BLANK: BurglaryClaimFormData = {
  premisesLocation: "",
  buildingType: "",
  wasAnyoneHome: "no",
  entryMethod: "",
  evidenceOfViolence: "no",
  alarmFitted: "no",
  alarmActiveAtTime: "n_a",
  securityFirmName: "",
  exteriorLockTypes: "",
  policeStation: "",
  dateReported: "",
  obNumber: "",
  lossItems: [{ ...BLANK_ITEM }],
};

// ── Component ────────────────────────────────────────────────────────────

export function BurglaryClaimForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BurglaryClaimFormData>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>[]>([]);
  const [docUploads, setDocUploads] = useState<DocumentUploads>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const currentStep = STEPS[step];

  function update<K extends keyof BurglaryClaimFormData>(
    key: K,
    value: BurglaryClaimFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateItem(index: number, field: keyof LossItem, value: string) {
    setForm((prev) => {
      const items = [...prev.lossItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, lossItems: items };
    });
    setItemErrors((prev) => {
      const next = [...prev];
      if (next[index]) {
        const copy = { ...next[index] };
        delete copy[field];
        next[index] = copy;
      }
      return next;
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      lossItems: [...prev.lossItems, { ...BLANK_ITEM }],
    }));
  }

  function removeItem(index: number) {
    if (form.lossItems.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      lossItems: prev.lossItems.filter((_, i) => i !== index),
    }));
    setItemErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function getStepFields(key: StepKey): string[] {
    switch (key) {
      case "premises":
        return ["premisesLocation", "buildingType", "wasAnyoneHome"];
      case "entry":
        return ["entryMethod", "evidenceOfViolence"];
      case "security":
        return [
          "alarmFitted",
          "alarmActiveAtTime",
          "securityFirmName",
          "exteriorLockTypes",
        ];
      case "police":
        return ["policeStation", "dateReported", "obNumber"];
      case "inventory":
        return ["lossItems"];
      case "documents":
        return [];
    }
  }

  function validateStep(): boolean {
    // Document step validation
    if (currentStep.key === "documents") {
      const newDocErrors: Record<string, string> = {};
      let hasError = false;
      BURGLARY_DOC_CATEGORIES.forEach((cat) => {
        if (
          cat.required &&
          (!docUploads[cat.key] || docUploads[cat.key].length === 0)
        ) {
          newDocErrors[cat.key] = `${cat.label} is required`;
          hasError = true;
        }
      });
      setDocErrors(newDocErrors);
      return !hasError;
    }

    // Form field validation
    const result = burglaryClaimSchema.safeParse(form);
    if (result.success) {
      setErrors({});
      setItemErrors([]);
      return true;
    }

    const stepFields = getStepFields(currentStep.key);
    const stepErrors: Record<string, string> = {};
    const newItemErrors: Record<string, string>[] = form.lossItems.map(
      () => ({}),
    );
    let hasError = false;

    result.error.issues.forEach((err) => {
      const field = err.path[0] as string;
      if (!stepFields.includes(field)) return;

      if (field === "lossItems" && err.path.length > 1) {
        const idx = err.path[1] as number;
        const itemField = err.path[2] as string;
        if (newItemErrors[idx]) {
          newItemErrors[idx][itemField] = err.message;
        }
        hasError = true;
      } else {
        stepErrors[field] = err.message;
        hasError = true;
      }
    });

    setErrors(stepErrors);
    setItemErrors(newItemErrors);
    return !hasError;
  }

  function handleNext() {
    if (validateStep()) {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      } else {
        const result = burglaryClaimSchema.safeParse(form);
        if (result.success) {
          setSubmitted(true);
        }
      }
    }
  }

  function handleBack() {
    if (step > 0) {
      setErrors({});
      setItemErrors([]);
      setDocErrors({});
      setStep(step - 1);
    }
  }

  // ── Total loss value ─────────────────────────────────────────────────

  const totalLoss = form.lossItems.reduce((sum, item) => {
    const val = parseFloat(item.replacementValue) || 0;
    return sum + val;
  }, 0);

  // ── Success state ────────────────────────────────────────────────────

  if (submitted) {
    const totalDocs = Object.values(docUploads).reduce(
      (s, f) => s + f.length,
      0,
    );
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Burglary Claim Submitted
          </h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Your claim has been submitted with {form.lossItems.length} stolen
            item{form.lossItems.length !== 1 ? "s" : ""} totalling KES{" "}
            {totalLoss.toLocaleString()} and {totalDocs} supporting document
            {totalDocs !== 1 ? "s" : ""}. An agent will verify the O.B. Number (
            {form.obNumber}) and begin the investigation.
          </p>
          <Button
            onClick={() => {
              setSubmitted(false);
              setForm(BLANK);
              setDocUploads({});
              setStep(0);
            }}
          >
            Submit Another Claim
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Burglary Insurance Claim</CardTitle>
        <CardDescription>
          Complete all sections to report a burglary and list stolen items.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step indicator */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => {
                  if (i < step) {
                    setErrors({});
                    setItemErrors([]);
                    setDocErrors({});
                    setStep(i);
                  }
                }}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors",
                  i === step
                    ? "border-primary bg-primary/5 text-primary"
                    : i < step
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 cursor-pointer hover:bg-emerald-500/10"
                      : "border-transparent text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Step: Premises ──────────────────────────────────────────── */}
        {currentStep.key === "premises" && (
          <FieldSet>
            <FieldLegend>Premises Details</FieldLegend>
            <FieldGroup>
              <Field data-invalid={!!errors.premisesLocation}>
                <FieldLabel>Premises Location (Plot / Street No.)</FieldLabel>
                <Input
                  placeholder="e.g. Plot 42, Ngong Road, Kilimani"
                  value={form.premisesLocation}
                  onChange={(e) => update("premisesLocation", e.target.value)}
                />
                <FieldError>{errors.premisesLocation}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.buildingType}>
                  <FieldLabel>Building Type</FieldLabel>
                  <Select
                    value={form.buildingType}
                    onValueChange={(val) => update("buildingType", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="bungalow">Bungalow</SelectItem>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="shop">Shop / Retail</SelectItem>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.buildingType}</FieldError>
                </Field>
                <Field data-invalid={!!errors.wasAnyoneHome}>
                  <FieldLabel>Was Anyone Home?</FieldLabel>
                  <Select
                    value={form.wasAnyoneHome}
                    onValueChange={(val) =>
                      update("wasAnyoneHome", val as "yes" | "no")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.wasAnyoneHome}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

        {/* ── Step: Entry ─────────────────────────────────────────────── */}
        {currentStep.key === "entry" && (
          <FieldSet>
            <FieldLegend>Method of Entry</FieldLegend>
            <FieldGroup>
              <Field data-invalid={!!errors.entryMethod}>
                <FieldLabel>How Was Entry Made?</FieldLabel>
                <Textarea
                  placeholder="Describe how the intruder gained entry (e.g. broken window, picked lock, forced door)..."
                  rows={4}
                  value={form.entryMethod}
                  onChange={(e) => update("entryMethod", e.target.value)}
                />
                <FieldError>{errors.entryMethod}</FieldError>
              </Field>
              <Field data-invalid={!!errors.evidenceOfViolence}>
                <FieldLabel>Evidence of Physical Violence?</FieldLabel>
                <Select
                  value={form.evidenceOfViolence}
                  onValueChange={(val) =>
                    update("evidenceOfViolence", val as "yes" | "no")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">
                      Yes — visible damage or force marks
                    </SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError>{errors.evidenceOfViolence}</FieldError>
              </Field>
            </FieldGroup>
          </FieldSet>
        )}

        {/* ── Step: Security ──────────────────────────────────────────── */}
        {currentStep.key === "security" && (
          <FieldSet>
            <FieldLegend>Security Details</FieldLegend>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.alarmFitted}>
                  <FieldLabel>Alarm Fitted?</FieldLabel>
                  <Select
                    value={form.alarmFitted}
                    onValueChange={(val) =>
                      update("alarmFitted", val as "yes" | "no")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.alarmFitted}</FieldError>
                </Field>
                <Field data-invalid={!!errors.alarmActiveAtTime}>
                  <FieldLabel>Was the Alarm Active?</FieldLabel>
                  <Select
                    value={form.alarmActiveAtTime}
                    onValueChange={(val) =>
                      update("alarmActiveAtTime", val as "yes" | "no" | "n_a")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="n_a">N/A — No alarm</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.alarmActiveAtTime}</FieldError>
                </Field>
              </div>
              <Field data-invalid={!!errors.securityFirmName}>
                <FieldLabel>Security Firm Name (optional)</FieldLabel>
                <Input
                  placeholder="e.g. G4S, KK Security"
                  value={form.securityFirmName ?? ""}
                  onChange={(e) => update("securityFirmName", e.target.value)}
                />
              </Field>
              <Field data-invalid={!!errors.exteriorLockTypes}>
                <FieldLabel>Types of Locks on Exterior Doors</FieldLabel>
                <Input
                  placeholder="e.g. Deadbolt, Padlock, Yale lock"
                  value={form.exteriorLockTypes}
                  onChange={(e) => update("exteriorLockTypes", e.target.value)}
                />
                <FieldError>{errors.exteriorLockTypes}</FieldError>
              </Field>
            </FieldGroup>
          </FieldSet>
        )}

        {/* ── Step: Police ────────────────────────────────────────────── */}
        {currentStep.key === "police" && (
          <FieldSet>
            <FieldLegend>Police Report</FieldLegend>
            <FieldGroup>
              <Field data-invalid={!!errors.policeStation}>
                <FieldLabel>Police Station</FieldLabel>
                <Input
                  placeholder="e.g. Kilimani Police Station"
                  value={form.policeStation}
                  onChange={(e) => update("policeStation", e.target.value)}
                />
                <FieldError>{errors.policeStation}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.dateReported}>
                  <FieldLabel>Date Reported</FieldLabel>
                  <Input
                    type="date"
                    value={form.dateReported}
                    onChange={(e) => update("dateReported", e.target.value)}
                  />
                  <FieldError>{errors.dateReported}</FieldError>
                </Field>
                <Field data-invalid={!!errors.obNumber}>
                  <FieldLabel>O.B. Number</FieldLabel>
                  <Input
                    placeholder="Occurrence Book number"
                    value={form.obNumber}
                    onChange={(e) => update("obNumber", e.target.value)}
                  />
                  <FieldError>{errors.obNumber}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

        {/* ── Step: Inventory ─────────────────────────────────────────── */}
        {currentStep.key === "inventory" && (
          <FieldSet>
            <FieldLegend>Loss Inventory</FieldLegend>
            {errors.lossItems && (
              <p className="text-sm text-destructive">{errors.lossItems}</p>
            )}
            <div className="space-y-4">
              {form.lossItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      Item {idx + 1}
                    </span>
                    {form.lossItems.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <FieldGroup>
                    <Field data-invalid={!!itemErrors[idx]?.description}>
                      <FieldLabel>Description</FieldLabel>
                      <Input
                        placeholder="e.g. Samsung 55-inch Smart TV"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                      />
                      <FieldError>{itemErrors[idx]?.description}</FieldError>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field data-invalid={!!itemErrors[idx]?.purchaseDate}>
                        <FieldLabel>Purchase Date</FieldLabel>
                        <Input
                          type="date"
                          value={item.purchaseDate}
                          onChange={(e) =>
                            updateItem(idx, "purchaseDate", e.target.value)
                          }
                        />
                        <FieldError>{itemErrors[idx]?.purchaseDate}</FieldError>
                      </Field>
                      <Field data-invalid={!!itemErrors[idx]?.originalCost}>
                        <FieldLabel>Original Cost (KES)</FieldLabel>
                        <Input
                          placeholder="e.g. 65000"
                          value={item.originalCost}
                          onChange={(e) =>
                            updateItem(idx, "originalCost", e.target.value)
                          }
                        />
                        <FieldError>{itemErrors[idx]?.originalCost}</FieldError>
                      </Field>
                      <Field data-invalid={!!itemErrors[idx]?.replacementValue}>
                        <FieldLabel>Replacement Value (KES)</FieldLabel>
                        <Input
                          placeholder="e.g. 72000"
                          value={item.replacementValue}
                          onChange={(e) =>
                            updateItem(idx, "replacementValue", e.target.value)
                          }
                        />
                        <FieldError>
                          {itemErrors[idx]?.replacementValue}
                        </FieldError>
                      </Field>
                    </div>
                  </FieldGroup>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full gap-1.5"
                onClick={addItem}
              >
                <Plus className="h-4 w-4" />
                Add Another Item
              </Button>

              {/* Total */}
              {totalLoss > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="text-sm font-medium text-foreground">
                    Total Loss Value
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    KES {totalLoss.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </FieldSet>
        )}

        {/* ── Step: Documents ─────────────────────────────────────────── */}
        {currentStep.key === "documents" && (
          <DocumentUploader
            categories={BURGLARY_DOC_CATEGORIES}
            uploads={docUploads}
            onUploadsChange={(uploads) => {
              setDocUploads(uploads);
              setDocErrors((prev) => {
                const next = { ...prev };
                Object.keys(uploads).forEach((k) => {
                  if (uploads[k]?.length > 0) delete next[k];
                });
                return next;
              });
            }}
            errors={docErrors}
          />
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <Button onClick={handleNext} className="gap-1.5">
            {step === STEPS.length - 1 ? "Submit Claim" : "Next"}
            {step < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
