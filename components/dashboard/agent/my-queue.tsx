"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type ClaimStatus =
  | "pending"
  | "assigned"
  | "surveyor_dispatched"
  | "under_review"
  | "assessment_complete"
  | "approved"
  | "settled"
  | "rejected";

interface QueueClaim {
  id: string;
  claimNumber: string;
  policyholderName: string;
  policyType: "motor" | "burglary";
  status: ClaimStatus;
  description: string;
  createdAt: string;
}

interface MyQueueProps {
  claims: QueueClaim[];
  onSelectClaim?: (claim: QueueClaim) => void;
  selectedClaimId?: string;
}

const statusLabels: Record<ClaimStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  surveyor_dispatched: "Surveyor Dispatched",
  under_review: "Under Review",
  assessment_complete: "Assessment Complete",
  approved: "Approved",
  settled: "Settled",
  rejected: "Rejected",
};

const statusColors: Record<ClaimStatus, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  surveyor_dispatched:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  under_review:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  assessment_complete:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function MyQueue({
  claims,
  onSelectClaim,
  selectedClaimId,
}: MyQueueProps) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = claims.filter((c) => {
    if (filter === "active")
      return !["settled", "rejected", "approved"].includes(c.status);
    if (filter === "resolved")
      return ["settled", "rejected", "approved"].includes(c.status);
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">My Queue</CardTitle>
            <CardDescription>
              {claims.length} claim{claims.length !== 1 ? "s" : ""} assigned to
              you
            </CardDescription>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-1 rounded-lg bg-muted p-0.5">
          {(["all", "active", "resolved"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No claims in this category.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((claim) => {
              const isExpanded = expandedId === claim.id;
              const isSelected = selectedClaimId === claim.id;

              return (
                <div
                  key={claim.id}
                  className={`rounded-lg border p-3 transition-all cursor-pointer hover:bg-muted/30 ${
                    isSelected ? "ring-2 ring-primary/50 border-primary/30" : ""
                  }`}
                  onClick={() => onSelectClaim?.(claim)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {claim.claimNumber}
                      </span>
                      <Badge
                        variant={
                          claim.policyType === "motor" ? "default" : "secondary"
                        }
                      >
                        {claim.policyType === "motor" ? "Motor" : "Burglary"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          statusColors[claim.status]
                        }`}
                      >
                        {statusLabels[claim.status]}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : claim.id);
                        }}
                        className="rounded p-0.5 hover:bg-muted"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground">
                          {claim.policyholderName}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {claim.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Filed{" "}
                        {new Date(claim.createdAt).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
