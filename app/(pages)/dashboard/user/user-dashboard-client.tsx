"use client";

import Link from "next/link";
import { DeleteDraftButton } from "@/components/claims/delete-draft-button";
import { useOrg } from "@/lib/org-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FilePlus2,
  ArrowUpRight,
  Car,
  House,
  FileClock,
  Bell,
} from "lucide-react";
import {
  CLOSED_CLAIM_STATUSES,
  claimNextAction,
} from "@/lib/claim-record-policy";
import { statusLabels, type ClaimStatus } from "@/lib/claim-workflow";
import type {
  getMyClaims,
  getMyPolicies,
  getMyNotifications,
} from "@/app/actions/user/my-claims";

interface Props {
  userName: string;
  claims: Awaited<ReturnType<typeof getMyClaims>>;
  policies: Awaited<ReturnType<typeof getMyPolicies>>;
  notifications: Awaited<ReturnType<typeof getMyNotifications>>;
}

export function UserDashboardClient({
  userName,
  claims,
  policies,
  notifications,
}: Props) {
  const { currentOrg } = useOrg();
  const scoped = claims.filter(
    (c) => !currentOrg || c.organizationId === currentOrg.id,
  );
  const profiles = policies.filter(
    (p) => !currentOrg || p.organizationId === currentOrg.id,
  );
  const drafts = scoped.filter((c) => c.status === "draft");
  const submitted = scoped
    .filter((c) => c.status !== "draft")
    .sort(
      (a, b) =>
        b.openRequestCount - a.openRequestCount ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const active = submitted.filter((c) => !CLOSED_CLAIM_STATUSES.has(c.status));
  const unread = notifications.filter((n) => !n.read);
  return (
    <div className="portal-page">
      <div>
        <p className="portal-eyebrow">Policyholder portal</p>
        <h1 className="portal-heading mt-2">
          Welcome, {userName.split(" ")[0]}
        </h1>
        <p className="portal-intro">
          Report an incident as soon as you can. You can save a draft and add
          supporting documents after your report is received.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active claims", value: active.length, icon: FileClock },
          { label: "Saved drafts", value: drafts.length, icon: FilePlus2 },
          { label: "Unread updates", value: unread.length, icon: Bell },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{item.value}</p>
              </div>
              <item.icon className="size-12 rounded-xl bg-primary/10 p-3 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {p.policyType === "motor" ? (
                  <Car className="size-5 text-primary" />
                ) : (
                  <House className="size-5 text-primary" />
                )}
                {p.policyType === "motor" ? "Motor" : "Burglary"} policy
              </CardTitle>
              <CardDescription>
                {p.policyNumber} · {p.organizationName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                {p.insuredAsset || "Insured asset details pending confirmation"}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.source === "demo"
                  ? "Demo profile"
                  : "Manually entered profile"}{" "}
                · {p.status}.{" "}
                {p.coverageStart && p.coverageEnd
                  ? `${p.coverageStart} to ${p.coverageEnd}. `
                  : ""}
                Your insurer must confirm coverage.
              </p>
              <Button asChild>
                <Link href={`/claim-forms/${p.policyType}?policy=${p.id}`}>
                  <FilePlus2 />
                  Report an incident
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {profiles.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              <p className="font-medium">
                Your invitation has not added a policy yet
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Open the invitation your agent sent and accept it with your
                verified account. If the link has expired, ask your agent to
                resend it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Continue a draft</CardTitle>
            <CardDescription>
              Drafts have not been submitted for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {drafts.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"
              >
                <div>
                  <p className="font-medium">
                    {c.policyType === "motor" ? "Motor" : "Burglary"} incident ·{" "}
                    {c.policyNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saved {new Date(c.updatedAt).toLocaleString("en-KE")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/claim-forms/${c.policyType}?draft=${c.id}`}>
                      Resume draft
                      <ArrowUpRight />
                    </Link>
                  </Button>
                  <DeleteDraftButton claimId={c.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Your claims</CardTitle>
            <CardDescription>
              Open a claim for documents, requests and its history.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/notifications">
              Updates {unread.length ? `(${unread.length})` : ""}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="divide-y">
          {submitted.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No incident reports submitted yet.
            </p>
          ) : (
            submitted.map((c) => (
              <Link
                key={c.id}
                href={`/claims/${c.id}`}
                className="portal-row -mx-2 flex flex-wrap items-start justify-between gap-3 rounded-lg px-2 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-semibold">
                    {c.claimNumber}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.policyType === "motor" ? "Motor" : "Burglary"} ·{" "}
                    {c.policyNumber}
                  </p>
                  <p className="mt-2 text-sm">
                    {c.withdrawalRequestedAt
                      ? "Your withdrawal request is awaiting review."
                      : claimNextAction(c.status, c.openRequestCount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {statusLabels[c.status as ClaimStatus]}
                  </Badge>
                  <ArrowUpRight className="size-4" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
