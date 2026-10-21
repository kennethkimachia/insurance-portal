"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  statusLabels,
  claimStatuses,
  closedClaimStatuses,
  type ClaimStatus,
} from "@/lib/claim-workflow";

interface QueueClaim {
  id: string;
  claimNumber: string;
  policyholderName: string;
  policyType: "motor" | "burglary";
  status: ClaimStatus;
  description: string;
  createdAt: string;
  openRequestCount?: number;
  overdueRequestCount?: number;
}
interface MyQueueProps {
  claims: QueueClaim[];
  onSelectClaim?: (claim: QueueClaim) => void;
  selectedClaimId?: string;
  title?: string;
  description?: string;
}

export function MyQueue({
  claims,
  onSelectClaim,
  selectedClaimId,
  title = "My claim queue",
  description,
}: MyQueueProps) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [product, setProduct] = useState("all");
  const query = search.trim().toLowerCase();
  const filtered = claims.filter((claim) => {
    const closed = closedClaimStatuses.includes(claim.status);
    return (
      (filter === "all" || (filter === "active" ? !closed : closed)) &&
      (stage === "all" || claim.status === stage) &&
      (product === "all" || claim.policyType === product) &&
      (!query ||
        `${claim.claimNumber} ${claim.policyholderName} ${claim.description}`
          .toLowerCase()
          .includes(query))
    );
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          {description ||
            `${claims.length} assigned claim${claims.length === 1 ? "" : "s"}`}
        </CardDescription>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reference or policyholder"
          aria-label="Search claims"
        />
        <div className="flex flex-wrap gap-3 rounded-xl border bg-muted/20 p-3">
          <select
            aria-label="Filter by claim stage"
            className="min-h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setFilter("all");
            }}
          >
            <option value="all">All stages</option>
            {claimStatuses
              .filter((status) => status !== "draft")
              .map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
          </select>
          <select
            aria-label="Filter by policy type"
            className="min-h-9 rounded-md border bg-background px-2 text-sm"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="all">Both policy types</option>
            <option value="motor">Motor</option>
            <option value="burglary">Burglary</option>
          </select>
        </div>
        <div className="flex gap-1 rounded-xl bg-muted/70 p-1.5">
          {(["active", "resolved", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={filter === tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:text-foreground ${filter === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {tab === "resolved"
                ? "Closed"
                : tab === "active"
                  ? "Active"
                  : "All"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filtered.length === 0 ? (
          <p className="portal-empty">
            No matching claims.
          </p>
        ) : (
          filtered.map((claim) => (
            <article
              key={claim.id}
              className={`space-y-3 rounded-xl border p-4 transition-colors hover:border-primary/30 ${selectedClaimId === claim.id ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "bg-background/70"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/claims/${claim.id}`}
                  className="font-mono text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {claim.claimNumber}
                </Link>
                <Badge variant="secondary">{statusLabels[claim.status]}</Badge>
              </div>
              <p className="text-sm font-medium">
                {claim.policyholderName}{" "}
                <span className="text-xs capitalize text-muted-foreground">
                  · {claim.policyType}
                </span>
              </p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {claim.description}
              </p>
              {!!claim.openRequestCount && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {claim.openRequestCount} open information request
                  {claim.openRequestCount === 1 ? "" : "s"}
                  {claim.overdueRequestCount
                    ? ` ? ${claim.overdueRequestCount} overdue`
                    : ""}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={claim.createdAt}
                >
                  {new Date(claim.createdAt).toLocaleDateString("en-KE")}
                </time>
                {onSelectClaim ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectClaim(claim)}
                    aria-pressed={selectedClaimId === claim.id}
                  >
                    Select claim
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/claims/${claim.id}`}>Open claim</Link>
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
