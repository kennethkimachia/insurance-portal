"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReportField, ReportSelect } from "./report-fields";
import {
  updatePolicyProfile,
  type getVisiblePolicies,
} from "@/app/actions/policies";
import {
  policyProfileSchema,
  type PolicyProfileInput,
} from "@/lib/schemas/policy-profile";
import { toast } from "sonner";

export function PolicyProfileEditor({
  policy,
}: {
  policy: Awaited<ReturnType<typeof getVisiblePolicies>>[number];
}) {
  const [form, setForm] = useState<PolicyProfileInput>({
    status: policy.status as PolicyProfileInput["status"],
    source: policy.source as PolicyProfileInput["source"],
    insurerReference: policy.insurerReference ?? "",
    coverageStart: policy.coverageStart ?? "",
    coverageEnd: policy.coverageEnd ?? "",
    insuredAsset: policy.insuredAsset ?? "",
    coverageSummary: policy.coverageSummary ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function update(key: keyof PolicyProfileInput, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors({});
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = policyProfileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await updatePolicyProfile(
          policy.id,
          policy.version,
          parsed.data,
        );
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(
          "Policy profile saved. Submitted claim snapshots are preserved.",
        );
        router.refresh();
      } catch {
        toast.error("Could not save this profile. Please retry.");
      }
    });
  }
  const field = (
    key: keyof PolicyProfileInput,
    label: string,
    type = "text",
    multiline = false,
  ) => (
    <ReportField
      id={`${policy.id}-${key}`}
      label={label}
      type={type}
      multiline={multiline}
      value={form[key]}
      onChange={(value) => update(key, value)}
      error={errors[key]}
    />
  );
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer rounded-lg border bg-muted/20 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent">
        Edit recorded policy profile
      </summary>
      <form className="mt-4" onSubmit={save}>
        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={pending}>
          <ReportSelect
            id={`${policy.id}-source`}
            label="Profile source"
            value={form.source}
            options={[
              ["demo", "Demo"],
              ["manual", "Manually recorded"],
            ]}
            onChange={(value) => update("source", value)}
            error={errors.source}
          />
          <ReportSelect
            id={`${policy.id}-status`}
            label="Recorded status"
            value={form.status}
            options={[
              ["active", "Active"],
              ["expired", "Expired"],
              ["cancelled", "Cancelled"],
              ["unknown", "Not confirmed"],
            ]}
            onChange={(value) => update("status", value)}
            error={errors.status}
          />
          {field("insurerReference", "Insurer reference")}
          {field("insuredAsset", "Insured vehicle or premises")}
          {field("coverageStart", "Coverage start", "date")}
          {field("coverageEnd", "Coverage end", "date")}
          <div className="sm:col-span-2">
            {field(
              "coverageSummary",
              "Coverage summary and limitations",
              "text",
              true,
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            These are manually recorded details. The insurer must confirm
            coverage. Earlier claim snapshots keep the profile used at
            submission.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </fieldset>
      </form>
    </details>
  );
}
