"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Circle,
  UserCheck,
  FileSearch,
  ShieldCheck,
  Banknote,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { updateClaimStatus } from "@/app/actions/agent/manage-claims";

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
  { key: "surveyor_dispatched", label: "Surveyor Dispatched", icon: FileSearch },
  { key: "under_review", label: "Under Review", icon: FileSearch },
  { key: "assessment_complete", label: "Assessment Done", icon: ShieldCheck },
  { key: "approved", label: "Approved", icon: ShieldCheck },
  { key: "settled", label: "Settled", icon: Banknote },
];

function getStepIndex(status: ClaimStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

function getStatusLabel(status: ClaimStatus) {
  if (status === "rejected") return "Rejected";
  return STEPS.find((step) => step.key === status)?.label ?? status;
}

interface StatusEditorProps {
  claimNumber: string;
  currentStatus: ClaimStatus;
  claimId?: string;
  onStatusChange?: (newStatus: ClaimStatus, notification: string) => void;
}

export function StatusEditor({
  claimNumber,
  currentStatus,
  claimId,
  onStatusChange,
}: StatusEditorProps) {
  const [status, setStatus] = useState(currentStatus);
  const [pendingStatus, setPendingStatus] = useState<ClaimStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const currentIndex = getStepIndex(status);
  const isRejected = status === "rejected";

  function handleChange(newStatus: string) {
    const selected = newStatus as ClaimStatus;
    setError(null);

    if (selected === "rejected") {
      setStatus("rejected");
      return;
    }

    if (selected === status) return;
    setPendingStatus(selected);
    setConfirmOpen(true);
  }

  function confirmStatusChange() {
    if (!pendingStatus) return;
    const nextStatus = pendingStatus;

    if (claimId) {
      startTransition(async () => {
        const result = await updateClaimStatus(claimId, nextStatus);
        if (!result.success) {
          setError(result.error ?? "Unable to update this claim");
          return;
        }
        applyStatus(nextStatus);
      });
    } else {
      applyStatus(nextStatus);
    }
  }

  function applyStatus(nextStatus: ClaimStatus) {
    setStatus(nextStatus);
    setPendingStatus(null);
    setConfirmOpen(false);
    const msg = `Claim ${claimNumber} has been updated to "${getStatusLabel(nextStatus)}"`;
    setNotification(msg);
    onStatusChange?.(nextStatus, msg);
    setTimeout(() => setNotification(null), 4000);
  }

  function submitRejection() {
    if (!claimId) return;
    startTransition(async () => {
      const result = await updateClaimStatus(claimId, "rejected", rejectionReason);
      if (!result.success) {
        setError(result.error ?? "Unable to reject this claim");
        return;
      }
      setStatus("rejected");
      setRejectOpen(false);
      setError(null);
      const msg = `Claim ${claimNumber} was rejected with a reason supplied to the policyholder.`;
      setNotification(msg);
      onStatusChange?.("rejected", msg);
      setTimeout(() => setNotification(null), 4000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Claim Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Claim</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {claimNumber}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Move to stage</label>
            <Select value={status} onValueChange={handleChange} disabled={isPending}>
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
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {!isRejected && (
            <>
              <div className="relative mt-2">
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {STEPS.map((step, i) => {
                  const isCompleted = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  const StepIcon = isCompleted ? CheckCircle2 : step.icon;

                  return (
                    <div key={step.key} className="flex min-w-0 flex-col items-center text-center">
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
                        className={`mt-1 max-w-full text-[10px] leading-tight ${
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
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div>
                <p className="text-sm font-medium text-destructive">Rejection reason</p>
                <p className="text-xs text-muted-foreground">
                  This explanation will be shown to the policyholder.
                </p>
              </div>
              <Textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this claim cannot be accepted..."
                rows={4}
              />
              <Button
                type="button"
                variant="destructive"
                disabled={isPending || rejectionReason.trim().length < 10}
                onClick={() => setRejectOpen(true)}
              >
                Reject Claim
              </Button>
            </div>
          )}

          {notification && (
            <div className="animate-in slide-in-from-bottom-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Notification created
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{notification}</p>
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status change</AlertDialogTitle>
            <AlertDialogDescription>
              Move claim {claimNumber} from {getStatusLabel(status)} to {pendingStatus ? getStatusLabel(pendingStatus) : "the selected stage"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this claim?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject claim {claimNumber} and send the reason to the policyholder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitRejection} disabled={isPending} variant="destructive">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject claim"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}