"use client";

import { useState } from "react";
import {
  motorClaimSchema,
  type MotorClaimFormData,
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
  Car,
  User,
  MapPin,
  ShieldAlert,
  Wrench,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step definitions ─────────────────────────────────────────────────────

const STEPS = [
  { key: "vehicle", label: "Vehicle Details", icon: Car },
  { key: "driver", label: "Driver Details", icon: User },
  { key: "incident", label: "Incident Details", icon: MapPin },
  { key: "police", label: "Police Report", icon: ShieldAlert },
  { key: "damage", label: "Damage & Third Party", icon: Wrench },
  { key: "documents", label: "Documents", icon: Paperclip },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// ── Document categories for motor claims ─────────────────────────────────

const MOTOR_DOC_CATEGORIES: DocumentCategory[] = [
  {
    key: "police_abstract",
    label: "Police Abstract",
    description:
      "Official summary of the accident with O.B. Number from the police station",
    required: true,
    accept: "image/*,.pdf",
    multiple: false,
  },
  {
    key: "logbook",
    label: "Vehicle Logbook",
    description: "Clear copy of the vehicle logbook to prove ownership",
    required: true,
    accept: "image/*,.pdf",
    multiple: false,
  },
  {
    key: "driving_license",
    label: "Driving License",
    description:
      "Copy of the driving license of the person behind the wheel at the time",
    required: true,
    accept: "image/*,.pdf",
    multiple: false,
  },
  {
    key: "national_id",
    label: "National ID & KRA PIN",
    description:
      "Scanned copies of National ID and KRA PIN certificate for both policyholder and driver",
    required: true,
    accept: "image/*,.pdf",
    multiple: true,
  },
  {
    key: "accident_photos",
    label: "Accident Scene Photos",
    description: "Photographs of the accident scene from multiple angles",
    required: true,
    accept: "image/*",
    multiple: true,
  },
  {
    key: "damage_photos",
    label: "Vehicle Damage Photos",
    description:
      "High-resolution images of the vehicle damage with number plates visible",
    required: true,
    accept: "image/*",
    multiple: true,
  },
  {
    key: "repair_estimate",
    label: "Repair Estimate",
    description: "Formal repair estimate from an approved garage",
    required: true,
    accept: "image/*,.pdf",
    multiple: false,
  },
];

// ── Blank form ───────────────────────────────────────────────────────────

const BLANK: MotorClaimFormData = {
  registrationNumber: "",
  make: "",
  model: "",
  currentMileage: "",
  driverFullName: "",
  licenseNumber: "",
  yearsOfExperience: "",
  relationshipToPolicyholder: "",
  incidentDate: "",
  incidentTime: "",
  incidentLocation: "",
  weatherConditions: "",
  estimatedSpeed: "",
  policeStation: "",
  obNumber: "",
  reportingOfficer: "",
  damageSummary: "",
  isVehicleDrivable: "yes",
  vehicleCurrentLocation: "",
  thirdPartyRegistration: "",
  thirdPartyInjuries: "",
};

// ── Component ────────────────────────────────────────────────────────────

export function MotorClaimForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MotorClaimFormData>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docUploads, setDocUploads] = useState<DocumentUploads>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const currentStep = STEPS[step];

  function update<K extends keyof MotorClaimFormData>(
    key: K,
    value: MotorClaimFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateStep(): boolean {
    // Document step validation
    if (currentStep.key === "documents") {
      const newDocErrors: Record<string, string> = {};
      let hasError = false;
      MOTOR_DOC_CATEGORIES.forEach((cat) => {
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
    const result = motorClaimSchema.safeParse(form);
    if (result.success) {
      setErrors({});
      return true;
    }

    const stepFields = getStepFields(currentStep.key);
    const stepErrors: Record<string, string> = {};
    let hasError = false;

    result.error.issues.forEach((err) => {
      const field = err.path[0] as string;
      if (stepFields.includes(field)) {
        stepErrors[field] = err.message;
        hasError = true;
      }
    });

    setErrors(stepErrors);
    return !hasError;
  }

  function getStepFields(key: StepKey): string[] {
    switch (key) {
      case "vehicle":
        return ["registrationNumber", "make", "model", "currentMileage"];
      case "driver":
        return [
          "driverFullName",
          "licenseNumber",
          "yearsOfExperience",
          "relationshipToPolicyholder",
        ];
      case "incident":
        return [
          "incidentDate",
          "incidentTime",
          "incidentLocation",
          "weatherConditions",
          "estimatedSpeed",
        ];
      case "police":
        return ["policeStation", "obNumber", "reportingOfficer"];
      case "damage":
        return [
          "damageSummary",
          "isVehicleDrivable",
          "vehicleCurrentLocation",
          "thirdPartyRegistration",
          "thirdPartyInjuries",
        ];
      case "documents":
        return [];
    }
  }

  function handleNext() {
    if (validateStep()) {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      } else {
        // Final submit
        const result = motorClaimSchema.safeParse(form);
        if (result.success) {
          setSubmitted(true);
        }
      }
    }
  }

  function handleBack() {
    if (step > 0) {
      setErrors({});
      setDocErrors({});
      setStep(step - 1);
    }
  }

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
            Motor Claim Submitted
          </h2>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Your claim has been submitted with {totalDocs} document
            {totalDocs !== 1 ? "s" : ""}. An agent will review your vehicle
            details, verify the O.B. Number ({form.obNumber}) with the police,
            and begin the investigation process.
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
        <CardTitle className="text-lg">Motor Insurance Claim</CardTitle>
        <CardDescription>
          Complete all sections to report a motor accident or theft.
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

        {/* Step content */}
        {currentStep.key === "vehicle" && (
          <FieldSet>
            <FieldLegend>Vehicle Details</FieldLegend>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.registrationNumber}>
                  <FieldLabel>Registration Number</FieldLabel>
                  <Input
                    placeholder="e.g. KDA 123A"
                    value={form.registrationNumber}
                    onChange={(e) =>
                      update("registrationNumber", e.target.value)
                    }
                  />
                  <FieldError>{errors.registrationNumber}</FieldError>
                </Field>
                <Field data-invalid={!!errors.make}>
                  <FieldLabel>Make</FieldLabel>
                  <Input
                    placeholder="e.g. Toyota"
                    value={form.make}
                    onChange={(e) => update("make", e.target.value)}
                  />
                  <FieldError>{errors.make}</FieldError>
                </Field>
                <Field data-invalid={!!errors.model}>
                  <FieldLabel>Model</FieldLabel>
                  <Input
                    placeholder="e.g. Corolla"
                    value={form.model}
                    onChange={(e) => update("model", e.target.value)}
                  />
                  <FieldError>{errors.model}</FieldError>
                </Field>
                <Field data-invalid={!!errors.currentMileage}>
                  <FieldLabel>Current Mileage (km)</FieldLabel>
                  <Input
                    placeholder="e.g. 45000"
                    value={form.currentMileage}
                    onChange={(e) => update("currentMileage", e.target.value)}
                  />
                  <FieldError>{errors.currentMileage}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

        {currentStep.key === "driver" && (
          <FieldSet>
            <FieldLegend>Driver Details</FieldLegend>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.driverFullName}>
                  <FieldLabel>Driver&apos;s Full Name</FieldLabel>
                  <Input
                    placeholder="Full name as on license"
                    value={form.driverFullName}
                    onChange={(e) => update("driverFullName", e.target.value)}
                  />
                  <FieldError>{errors.driverFullName}</FieldError>
                </Field>
                <Field data-invalid={!!errors.licenseNumber}>
                  <FieldLabel>License Number</FieldLabel>
                  <Input
                    placeholder="Driving license number"
                    value={form.licenseNumber}
                    onChange={(e) => update("licenseNumber", e.target.value)}
                  />
                  <FieldError>{errors.licenseNumber}</FieldError>
                </Field>
                <Field data-invalid={!!errors.yearsOfExperience}>
                  <FieldLabel>Years of Driving Experience</FieldLabel>
                  <Input
                    placeholder="e.g. 5"
                    value={form.yearsOfExperience}
                    onChange={(e) =>
                      update("yearsOfExperience", e.target.value)
                    }
                  />
                  <FieldError>{errors.yearsOfExperience}</FieldError>
                </Field>
                <Field data-invalid={!!errors.relationshipToPolicyholder}>
                  <FieldLabel>Relationship to Policyholder</FieldLabel>
                  <Select
                    value={form.relationshipToPolicyholder}
                    onValueChange={(val) =>
                      update("relationshipToPolicyholder", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Self (Policyholder)</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.relationshipToPolicyholder}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

        {currentStep.key === "incident" && (
          <FieldSet>
            <FieldLegend>Incident Details</FieldLegend>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.incidentDate}>
                  <FieldLabel>Date of Incident</FieldLabel>
                  <Input
                    type="date"
                    value={form.incidentDate}
                    onChange={(e) => update("incidentDate", e.target.value)}
                  />
                  <FieldError>{errors.incidentDate}</FieldError>
                </Field>
                <Field data-invalid={!!errors.incidentTime}>
                  <FieldLabel>Time of Incident</FieldLabel>
                  <Input
                    type="time"
                    value={form.incidentTime}
                    onChange={(e) => update("incidentTime", e.target.value)}
                  />
                  <FieldError>{errors.incidentTime}</FieldError>
                </Field>
              </div>
              <Field data-invalid={!!errors.incidentLocation}>
                <FieldLabel>Location (Road / Town)</FieldLabel>
                <Input
                  placeholder="e.g. Mombasa Road, near Nyayo Stadium"
                  value={form.incidentLocation}
                  onChange={(e) => update("incidentLocation", e.target.value)}
                />
                <FieldError>{errors.incidentLocation}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.weatherConditions}>
                  <FieldLabel>Weather Conditions</FieldLabel>
                  <Select
                    value={form.weatherConditions}
                    onValueChange={(val) => update("weatherConditions", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clear">Clear / Sunny</SelectItem>
                      <SelectItem value="cloudy">Cloudy</SelectItem>
                      <SelectItem value="rainy">Rainy</SelectItem>
                      <SelectItem value="foggy">Foggy / Misty</SelectItem>
                      <SelectItem value="night">Night / Dark</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError>{errors.weatherConditions}</FieldError>
                </Field>
                <Field data-invalid={!!errors.estimatedSpeed}>
                  <FieldLabel>Estimated Speed (km/h)</FieldLabel>
                  <Input
                    placeholder="e.g. 60"
                    value={form.estimatedSpeed}
                    onChange={(e) => update("estimatedSpeed", e.target.value)}
                  />
                  <FieldError>{errors.estimatedSpeed}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

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
                <Field data-invalid={!!errors.obNumber}>
                  <FieldLabel>O.B. Number</FieldLabel>
                  <Input
                    placeholder="Occurrence Book number"
                    value={form.obNumber}
                    onChange={(e) => update("obNumber", e.target.value)}
                  />
                  <FieldError>{errors.obNumber}</FieldError>
                </Field>
                <Field data-invalid={!!errors.reportingOfficer}>
                  <FieldLabel>Reporting Officer</FieldLabel>
                  <Input
                    placeholder="Officer's name"
                    value={form.reportingOfficer}
                    onChange={(e) => update("reportingOfficer", e.target.value)}
                  />
                  <FieldError>{errors.reportingOfficer}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
        )}

        {currentStep.key === "damage" && (
          <FieldSet>
            <FieldLegend>Damage &amp; Third-Party Details</FieldLegend>
            <FieldGroup>
              <Field data-invalid={!!errors.damageSummary}>
                <FieldLabel>Damage Summary</FieldLabel>
                <Textarea
                  placeholder="Describe the damage to your vehicle in detail..."
                  rows={4}
                  value={form.damageSummary}
                  onChange={(e) => update("damageSummary", e.target.value)}
                />
                <FieldError>{errors.damageSummary}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.isVehicleDrivable}>
                  <FieldLabel>Is the Vehicle Still Drivable?</FieldLabel>
                  <Select
                    value={form.isVehicleDrivable}
                    onValueChange={(val) =>
                      update("isVehicleDrivable", val as "yes" | "no")
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
                  <FieldError>{errors.isVehicleDrivable}</FieldError>
                </Field>
                <Field data-invalid={!!errors.vehicleCurrentLocation}>
                  <FieldLabel>Vehicle&apos;s Current Location</FieldLabel>
                  <Input
                    placeholder="e.g. at Nairobi West Garage"
                    value={form.vehicleCurrentLocation}
                    onChange={(e) =>
                      update("vehicleCurrentLocation", e.target.value)
                    }
                  />
                  <FieldError>{errors.vehicleCurrentLocation}</FieldError>
                </Field>
              </div>
              <Field data-invalid={!!errors.thirdPartyRegistration}>
                <FieldLabel>
                  Third-Party Vehicle Registration (optional)
                </FieldLabel>
                <Input
                  placeholder="Registration number of other vehicle(s)"
                  value={form.thirdPartyRegistration ?? ""}
                  onChange={(e) =>
                    update("thirdPartyRegistration", e.target.value)
                  }
                />
              </Field>
              <Field data-invalid={!!errors.thirdPartyInjuries}>
                <FieldLabel>Third-Party Injuries (optional)</FieldLabel>
                <Textarea
                  placeholder="Describe any injuries sustained by third parties..."
                  rows={2}
                  value={form.thirdPartyInjuries ?? ""}
                  onChange={(e) => update("thirdPartyInjuries", e.target.value)}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        )}

        {/* Documents step */}
        {currentStep.key === "documents" && (
          <DocumentUploader
            categories={MOTOR_DOC_CATEGORIES}
            uploads={docUploads}
            onUploadsChange={(uploads) => {
              setDocUploads(uploads);
              // Clear errors for categories that now have files
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
