"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface NextStepsProps {
  step: {
    actionRequired: boolean;
    message: string;
    claimNumber: string;
  };
}

export function NextSteps({ step }: NextStepsProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`rounded-lg border p-4 ${
            step.actionRequired
              ? "border-amber-300/50 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20"
              : "border-emerald-300/50 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
          }`}
        >
          <div className="flex items-start gap-3">
            {step.actionRequired ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}
            <div>
              <p
                className={`text-sm font-semibold ${
                  step.actionRequired
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {step.actionRequired ? "Action Required" : "No Action Needed"}
              </p>
              <p
                className={`mt-1 text-sm ${
                  step.actionRequired
                    ? "text-amber-700 dark:text-amber-400/80"
                    : "text-emerald-700 dark:text-emerald-400/80"
                }`}
              >
                {step.message}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Regarding claim{" "}
          <span className="font-medium">{step.claimNumber}</span>
        </p>
      </CardContent>
    </Card>
  );
}
