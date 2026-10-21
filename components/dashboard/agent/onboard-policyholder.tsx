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
  phone: "",
  policyType: "motor",
  source: "demo",
  insurerReference: "",
  coverageStart: "",
  coverageEnd: "",
  insuredAsset: "",
  coverageSummary: "",
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
          return;
        }
        setMessage(
          `${result.policyholderName}: ${result.message} The policy becomes available after verified invitation acceptance.`,
        );
        setForm(emptyForm);
        await reloadInvitations();
      } catch {
        setError("Could not save the invitation. Please retry.");
      }
    });
  }
  const field = (
    key: keyof typeof emptyForm,
    label: string,
    type = "text",
    required = true,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`enroll-${key}`}>{label}</Label>
      <Input
        id={`enroll-${key}`}
        type={type}
        required={required}
        value={form[key]}
        onChange={(event) =>
          setForm((value) => ({ ...value, [key]: event.target.value }))
        }
        maxLength={
          key === "coverageSummary" ? 2000 : key === "insuredAsset" ? 500 : 255
        }
      />
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a policyholder</CardTitle>
        <CardDescription>
          {organizationId
            ? `Record a Motor or Burglary policy for ${organizationName || "the selected organization"}, then invite its holder.`
            : "An organization membership is required to invite policyholders."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {organizationId ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("fullName", "Full name")}
              {field("email", "Email", "email")}
              {field("phone", "Contact number (include country code)", "tel")}
              <div className="grid gap-1.5">
                <Label htmlFor="enroll-policyType">Policy</Label>
                <select
                  id="enroll-policyType"
                  value={form.policyType}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      policyType: event.target.value,
                    }))
                  }
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                >
                  <option value="motor">Motor</option>
                  <option value="burglary">Burglary</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="enroll-source">Policy record source</Label>
              <select
                id="enroll-source"
                value={form.source}
                onChange={(event) =>
                  setForm((value) => ({ ...value, source: event.target.value }))
                }
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="demo">
                  Demonstration policy (synthetic data)
                </option>
                <option value="manual">Manually recorded insurer policy</option>
              </select>
              <p className="text-xs text-muted-foreground">
                A portal policy record does not verify insurer coverage.
              </p>
            </div>
            {field(
              "insurerReference",
              "Insurer policy reference",
              "text",
              form.source === "manual",
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {field(
                "coverageStart",
                "Coverage starts",
                "date",
                form.source === "manual",
              )}
              {field(
                "coverageEnd",
                "Coverage ends",
                "date",
                form.source === "manual",
              )}
            </div>
            {field(
              "insuredAsset",
              form.policyType === "motor"
                ? "Insured vehicle (registration and description)"
                : "Insured premises (address and description)",
            )}
            {field("coverageSummary", "Coverage summary (manually recorded)")}
            <p className="text-xs text-muted-foreground">
              The portal stores the invited contact details and policy after
              acceptance. No ID document is needed for account activation. Use
              synthetic identities for demonstrations.
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
              {pending
                ? "Saving invitation…"
                : "Create policyholder invitation"}
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
