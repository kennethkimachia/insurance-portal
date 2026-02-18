"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Circle,
  UserCheck,
  FileSearch,
  ShieldCheck,
  Banknote,
  CheckCircle2,
} from "lucide-react";
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

const STEPS: {
  key: ClaimStatus;
  label: string;
  icon: typeof Circle;
}[] = [
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
];

function getStepIndex(status: ClaimStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

interface StatusEditorProps {
  claimNumber: string;
  currentStatus: ClaimStatus;
  onStatusChange?: (newStatus: ClaimStatus, notification: string) => void;
}

export function StatusEditor({
  claimNumber,
  currentStatus,
  onStatusChange,
}: StatusEditorProps) {
  const [status, setStatus] = useState(currentStatus);
  const [notification, setNotification] = useState<string | null>(null);
  const currentIndex = getStepIndex(status);
  const isRejected = status === "rejected";

  function handleChange(newStatus: string) {
    const s = newStatus as ClaimStatus;
    setStatus(s);

    const step = STEPS.find((st) => st.key === s);
    const msg = `Claim ${claimNumber} has been updated to "${step?.label || s}"`;
    setNotification(msg);
    onStatusChange?.(s, msg);

    // Auto-dismiss notification
    setTimeout(() => setNotification(null), 4000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Claim Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Claim reference */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Claim</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {claimNumber}
            </span>
          </div>

          {/* Status dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Move to stage
            </label>
            <Select value={status} onValueChange={handleChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEPS.map((step) => (
                  <SelectItem key={step.key} value={step.key}>
                    {step.label}
                  </SelectItem>
                ))}
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visual progress bar */}
          {!isRejected && (
            <>
              <div className="relative mt-2">
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-500 ease-in-out"
                    style={{
                      width: `${((currentIndex + 1) / STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Step indicators */}
              <div className="grid grid-cols-7 gap-0.5">
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
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                          isCurrent
                            ? "bg-primary text-primary-foreground ring-3 ring-primary/20"
                            : isCompleted
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <StepIcon className="h-3.5 w-3.5" />
                      </div>
                      <span
                        className={`mt-1 text-[10px] leading-tight ${
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
            </>
          )}

          {isRejected && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
              <p className="text-sm font-medium text-destructive">
                Claim Rejected
              </p>
            </div>
          )}

          {/* Notification toast */}
          {notification && (
            <div className="animate-in slide-in-from-bottom-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                ✓ Notification created
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {notification}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
