"use client";
import Link from "next/link";
import { useState } from "react";
import { DeleteDraftButton } from "@/components/claims/delete-draft-button";
import { MotorClaimForm } from "@/components/claims/motor-claim-form";
import { BurglaryClaimForm } from "@/components/claims/burglary-claim-form";
import type { ResumableClaimDraft } from "@/components/claims/use-claim-draft";
import type {
  getPoliciesForClaimForm,
  getMyDrafts,
} from "@/app/actions/user/my-claims";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Car, Building2, ArrowLeft } from "lucide-react";
export default function ClaimsPageClient({
  policies,
  drafts,
  initialPolicyId,
  initialDraft,
  initialClaimId,
  recoveryMessage,
}: {
  policies: Awaited<ReturnType<typeof getPoliciesForClaimForm>>;
  drafts: Awaited<ReturnType<typeof getMyDrafts>>;
  initialPolicyId?: string;
  initialDraft?: ResumableClaimDraft;
  initialClaimId?: string;
  recoveryMessage?: string;
}) {
  const [search, setSearch] = useState("");
  const selected = policies.find((p) => p.id === initialPolicyId);
  const visible = policies.filter((p) =>
    `${p.policyNumber} ${p.policyType} ${p.policyholderName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="portal-page max-w-3xl">
      <div>
        <h1 className="portal-heading">
          {initialDraft ? "Resume your incident report" : "Report an incident"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose an enrolled Motor or Burglary policy. You can report before all
          supporting information is available.
        </p>
      </div>
      {recoveryMessage && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300/70 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10 p-3 text-sm leading-6 text-amber-950 dark:text-amber-200"
        >
          {recoveryMessage}
        </p>
      )}
      {selected ? (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/claim-forms">
              <ArrowLeft />
              Choose another policy
            </Link>
          </Button>
          {selected.policyType === "motor" ? (
            <MotorClaimForm
              key={selected.id}
              policyId={selected.id}
              policyContext={selected}
              initialDraft={initialDraft}
              initialClaimId={initialClaimId}
            />
          ) : (
            <BurglaryClaimForm
              key={selected.id}
              policyId={selected.id}
              policyContext={selected}
              initialDraft={initialDraft}
              initialClaimId={initialClaimId}
            />
          )}
        </>
      ) : (
        <>
          {drafts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved drafts</CardTitle>
                <CardDescription>
                  Resume a confirmed save before starting another report for the
                  same incident.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className="portal-row flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/15 p-4 text-sm"
                  >
                    <Link
                      className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 hover:text-primary"
                      href={`/claim-forms/${d.policyType}?draft=${d.id}`}
                    >
                      <span>
                        {d.policyNumber} ·{" "}
                        {d.policyType === "motor" ? "Motor" : "Burglary"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Saved{" "}
                        {new Date(d.updatedAt).toLocaleString("en-KE", {
                          timeZone: "Africa/Nairobi",
                        })}
                      </span>
                    </Link>
                    <DeleteDraftButton claimId={d.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {policies.length > 2 && (
            <>
              <label htmlFor="policy-search" className="text-sm font-medium">
                Find a policy or policyholder
              </label>
              <Input
                id="policy-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, policy number or type"
              />
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {p.policyType === "motor" ? (
                      <Car className="size-10 rounded-xl bg-primary/10 p-2.5 text-primary" />
                    ) : (
                      <Building2 className="size-10 rounded-xl bg-primary/10 p-2.5 text-primary" />
                    )}
                    {p.policyType === "motor" ? "Motor" : "Burglary"}
                  </CardTitle>
                  <CardDescription>
                    {p.policyNumber}
                    {p.policyholderName ? ` · ${p.policyholderName}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    {p.insuredAsset || "Asset details pending confirmation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.source === "demo" ? "Demo profile" : "Manual profile"}.
                    Insurer coverage requires confirmation.
                  </p>
                  <Button asChild>
                    <Link
                      href={`/claim-forms/${p.policyType}?policy=${p.id}${initialClaimId ? `&draft=${initialClaimId}` : ""}`}
                    >
                      Start report
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {visible.length === 0 && (
            <Card>
              <CardContent className="space-y-2 pt-6">
                <p className="font-medium">
                  {policies.length
                    ? "No matching policy"
                    : "No enrolled policy available"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {policies.length
                    ? "Try another name or policy number."
                    : "Accept your verified invitation or contact the agent who invited you."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
