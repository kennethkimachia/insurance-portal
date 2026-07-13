"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface ProgressStep {
  id: string;
  stepOrder: number;
  label: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

interface ClaimTrackerDynamicProps {
  claim: {
    claimNumber: string;
    policyType: "motor" | "burglary";
    description: string;
    createdAt: string;
  };
  progressSteps: ProgressStep[];
}

export function ClaimTrackerDynamic({
  claim,
  progressSteps,
}: ClaimTrackerDynamicProps) {
  const completedCount = progressSteps.filter((s) => s.isCompleted).length;
  const totalSteps = progressSteps.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

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
              claim.policyType === "motor" ? "default" : "secondary"
            }
          >
            {claim.policyType === "motor" ? "Motor" : "Burglary"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {progressSteps.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your claim has been submitted. Progress updates will appear here
              once your agent begins processing.
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="relative mb-6 mt-2">
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className="h-2.5 rounded-full bg-primary transition-all duration-700 ease-in-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {totalSteps} steps complete
                </span>
                <span className="text-xs font-medium text-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-1">
              {progressSteps.map((step, index) => {
                const isCurrent =
                  !step.isCompleted &&
                  (index === 0 || progressSteps[index - 1]?.isCompleted);

                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 rounded-lg p-3 transition-all ${
                      isCurrent
                        ? "border border-primary/30 bg-primary/5"
                        : step.isCompleted
                          ? "bg-emerald-500/5"
                          : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className="flex flex-col items-center pt-0.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                            : step.isCompleted
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : isCurrent ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                      </div>
                      {index < progressSteps.length - 1 && (
                        <div
                          className={`mt-1 w-px flex-1 ${
                            step.isCompleted ? "bg-emerald-500/30" : "bg-border"
                          }`}
                          style={{ minHeight: "8px" }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          isCurrent
                            ? "font-semibold text-foreground"
                            : step.isCompleted
                              ? "font-medium text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      {step.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {step.description}
                        </p>
                      )}
                      {step.isCompleted && step.completedAt && (
                        <p className="mt-1 text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
                          Completed{" "}
                          {new Date(step.completedAt).toLocaleDateString(
                            "en-KE",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      )}
                    </div>
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
