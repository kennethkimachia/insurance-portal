"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  FileSearch,
  UserCheck,
  ShieldCheck,
  Banknote,
} from "lucide-react";

type ClaimStatus =
  | "pending"
  | "assigned"
  | "surveyor_dispatched"
  | "under_review"
  | "assessment_complete"
  | "approved"
  | "settled"
  | "rejected";

interface ClaimTrackerProps {
  claim: {
    claimNumber: string;
    policyType: "motor" | "burglary";
    status: ClaimStatus;
    description: string;
    createdAt: string;
  };
}

const STEPS = [
  { key: "pending", label: "Submitted", icon: Circle },
  { key: "assigned", label: "Assigned", icon: UserCheck },
  {
    key: "surveyor_dispatched",
    label: "Surveyor Dispatched",
    icon: FileSearch,
  },
  { key: "under_review", label: "Under Review", icon: FileSearch },
  { key: "assessment_complete", label: "Assessment Done", icon: ShieldCheck },
  { key: "approved", label: "Approved", icon: ShieldCheck },
  { key: "settled", label: "Settled", icon: Banknote },
] as const;

function getStepIndex(status: ClaimStatus): number {
  const map: Record<ClaimStatus, number> = {
    pending: 0,
    assigned: 1,
    surveyor_dispatched: 2,
    under_review: 3,
    assessment_complete: 4,
    approved: 5,
    settled: 6,
    rejected: -1,
  };
  return map[status];
}

export function ClaimTracker({ claim }: ClaimTrackerProps) {
  const currentIndex = getStepIndex(claim.status);
  const isRejected = claim.status === "rejected";

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Claim Progress</CardTitle>
            <CardDescription className="mt-0.5">
              {claim.claimNumber} · {claim.description}
            </CardDescription>
          </div>
          <Badge
            variant={
              isRejected
                ? "destructive"
                : claim.policyType === "motor"
                  ? "default"
                  : "secondary"
            }
          >
            {claim.policyType === "motor" ? "Motor" : "Burglary"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isRejected ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
            <p className="font-medium text-destructive">Claim Rejected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please contact your agent for more details.
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="relative mb-6 mt-2">
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-700 ease-in-out"
                  style={{
                    width: `${((currentIndex + 1) / STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Step labels */}
            <div className="grid grid-cols-7 gap-1">
              {STEPS.map((step, i) => {
                const isCompleted = i <= currentIndex;
                const isCurrent = i === currentIndex;
                const StepIcon = isCompleted ? CheckCircle2 : step.icon;

                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isCompleted
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span
                      className={`mt-2 text-xs leading-tight ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : isCompleted
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Filed date */}
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Filed on{" "}
              {new Date(claim.createdAt).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
