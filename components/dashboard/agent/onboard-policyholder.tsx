"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardPolicyholder } from "@/app/actions/agent/onboard-policyholder";
import { getPolicyholderInvitations } from "@/app/actions/invitations";
import { InvitationList } from "@/components/auth/invitation-list";
import type { InvitationSummary } from "@/lib/invitations";
import { useEffect, useState, useTransition } from "react";

const emptyForm = {
  fullName: "",
  email: "",
  policyType: "motor",
};
export function OnboardPolicyholder({
  organizationName,
  organizationId,
}: {
  organizationName?: string;
  organizationId?: string;
}) {
  return (
    <PolicyholderEnrollment
      key={organizationId || "setup"}
      organizationName={organizationName}
      organizationId={organizationId}
    />
  );
}
function PolicyholderEnrollment({
  organizationName,
  organizationId,
}: {
  organizationName?: string;
  organizationId?: string;
}) {
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invites, setInvites] = useState<InvitationSummary[]>([]);
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(Boolean(organizationId));
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let current = true;
    if (!organizationId) return;
    getPolicyholderInvitations(organizationId)
      .then((items) => {
        if (current) setInvites(items);
      })
      .catch(() => {
        if (current) setListError("Could not load invitations.");
      })
      .finally(() => {
        if (current) setListLoading(false);
      });
    return () => {
      current = false;
    };
  }, [organizationId]);
  async function reloadInvitations() {
    if (!organizationId) return;
    try {
      setInvites(await getPolicyholderInvitations(organizationId));
      setListError("");
    } catch {
      setListError("Could not refresh invitations.");
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setFieldErrors({});
    if (!organizationId) {
      setError(
        "An organization membership is required. Ask your administrator to configure access.",
      );
      return;
    }
    startTransition(async () => {
      try {
        const data = new FormData();
        Object.entries(form).forEach(([key, value]) => data.set(key, value));
        data.set("organizationId", organizationId);
        const result = await onboardPolicyholder(data);
        if (!result.success) {
          setError(result.error);
          if ("fieldErrors" in result) setFieldErrors(result.fieldErrors ?? {});
          return;
        }
        setMessage(`${result.policyholderName}: ${result.message}`);
        setForm(emptyForm);
        await reloadInvitations();
      } catch {
        setError("Could not save the invitation. Please retry.");
      }
    });
  }
  const field = (
    key: "fullName" | "email",
    label: string,
    type = "text",
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`enroll-${key}`}>{label}</Label>
      <Input
        id={`enroll-${key}`}
        type={type}
        required
        disabled={pending}
        autoComplete={key === "fullName" ? "name" : "email"}
        value={form[key]}
        aria-invalid={!!fieldErrors[key]}
        aria-describedby={fieldErrors[key] ? `enroll-${key}-error` : undefined}
        onChange={(event) => {
          setForm((value) => ({ ...value, [key]: event.target.value }));
        }}
        maxLength={key === "fullName" ? 150 : 255}
      />
      {fieldErrors[key] && (
        <p id={`enroll-${key}-error`} className="text-xs text-destructive">
          {fieldErrors[key].join(" ")}
        </p>
      )}
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a policyholder</CardTitle>
        <CardDescription>
          {organizationId
            ? `Invite someone to join ${organizationName || "the selected organization"}.`
            : "An organization membership is required to invite policyholders."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {organizationId ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4">
              {field("fullName", "Full name")}
              {field("email", "Email", "email")}
              <div className="grid gap-1.5">
                <Label htmlFor="enroll-policyType">Policy type</Label>
                <select
                  id="enroll-policyType"
                  value={form.policyType}
                  disabled={pending}
                  aria-invalid={!!fieldErrors.policyType}
                  aria-describedby={
                    fieldErrors.policyType ? "enroll-policyType-error" : undefined
                  }
                  onChange={(event) => {
                    setForm((value) => ({
                      ...value,
                      policyType: event.target.value,
                    }));
                  }}
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="motor">Motor</option>
                  <option value="burglary">Burglary</option>
                </select>
                {fieldErrors.policyType && (
                  <p id="enroll-policyType-error" className="text-xs text-destructive">
                    {fieldErrors.policyType.join(" ")}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              They’ll receive an email to join. A demo policy is added automatically
              when they accept.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-lg border bg-muted/30 p-3 text-sm"
              >
                {message}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Sending invitation…" : "Send invitation"}
            </Button>
          </form>
        ) : (
          <p className="portal-empty">
            Ask your administrator to add you to an insurance organization.
          </p>
        )}
        {organizationId && (
          <div className="space-y-3">
            <h3 className="font-semibold">Policyholder invitations</h3>
            {listLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading invitations…
              </p>
            ) : listError ? (
              <div>
                <p role="alert" className="text-sm text-destructive">
                  {listError}
                </p>
                <Button variant="outline" size="sm" onClick={reloadInvitations}>
                  Retry
                </Button>
              </div>
            ) : (
              <InvitationList
                invitations={invites}
                onChanged={reloadInvitations}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
