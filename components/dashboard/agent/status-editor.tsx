"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2 } from "lucide-react";
import { updateClaimStatus } from "@/app/actions/agent/manage-claims";
import {
  availableTransitions,
  requiresOutcomeReason,
  statusLabels,
  type ClaimStatus,
} from "@/lib/claim-workflow";
import type { Role } from "@/lib/permissions";

interface StatusEditorProps {
  claimNumber: string;
  currentStatus: ClaimStatus;
  claimId?: string;
  role?: Role;
  onStatusChange?: (newStatus: ClaimStatus, notification: string) => void;
}

export function StatusEditor({
  claimNumber,
  currentStatus,
  claimId,
  role = "agent",
  onStatusChange,
}: StatusEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [next, setNext] = useState<ClaimStatus | "">("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState<"manual" | "simulated">("manual");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const transitions = availableTransitions(status, role);
  const isOutcome = ["approved", "rejected", "withdrawn", "settled"].includes(
    next,
  );
  const needsReason = !!next && requiresOutcomeReason(status, next);

  function save() {
    if (!claimId || !next) return;
    startTransition(async () => {
      try {
        const result = await updateClaimStatus(
          claimId,
          next,
          reason || undefined,
          { source, settlementAmount: amount, settlementReference: reference },
        );
        if (!result.success) {
          setError(result.error ?? "Unable to update the claim");
          return;
        }
        const message = `${claimNumber}: ${statusLabels[next]}`;
        setStatus(next);
        setNext("");
        setReason("");
        setError(null);
        setSaved(message);
        setConfirm(false);
        onStatusChange?.(next, message);
        router.refresh();
      } catch {
        setError("Unable to save. Your claim status has not been changed.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Claim status</CardTitle>
        <CardDescription>
          {claimNumber} · {statusLabels[status]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "pending" && (
          <p className="text-sm text-muted-foreground">
            A claims manager assigns the claim before the agent begins review.
          </p>
        )}
        {status === "awaiting_information" && (
          <p className="text-sm text-muted-foreground">
            Complete the information requests to resume review. Record why any
            unavailable evidence can be waived.
          </p>
        )}
        {!claimId ? (
          <p className="text-sm text-muted-foreground">
            Select a saved claim to update its status.
          </p>
        ) : transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no status changes available at this stage.
          </p>
        ) : (
          <>
            <label htmlFor="next-status" className="block text-sm font-medium">
              Next stage
            </label>
            <Select
              value={next}
              onValueChange={(value) => {
                setNext(value as ClaimStatus);
                setError(null);
                setSaved(null);
              }}
              disabled={pending}
            >
              <SelectTrigger id="next-status">
                <SelectValue placeholder="Choose a permitted stage" />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {next && (
              <>
                <label
                  htmlFor="outcome-reason"
                  className="block text-sm font-medium"
                >
                  {needsReason
                    ? "Explanation for the policyholder"
                    : "Update details (optional)"}
                </label>
                <Textarea
                  id="outcome-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={4000}
                  placeholder="Explain what has changed and what happens next."
                />
              </>
            )}
            {isOutcome && (
              <>
                <label
                  htmlFor="outcome-source"
                  className="block text-sm font-medium"
                >
                  Outcome source
                </label>
                <Select
                  value={source}
                  onValueChange={(value) =>
                    setSource(value as "manual" | "simulated")
                  }
                >
                  <SelectTrigger id="outcome-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manually recorded</SelectItem>
                    <SelectItem value="simulated">
                      Simulated for demonstration
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The source and explanation will appear in the
                  policyholder&apos;s history.
                </p>
              </>
            )}
            {next === "settled" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Record an amount and payment evidence reference. A simulated
                  settlement is labeled in the portal.
                </p>
                <label
                  htmlFor="settlement-amount"
                  className="block text-sm font-medium"
                >
                  Amount (KES)
                </label>
                <Input
                  id="settlement-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
                <label
                  htmlFor="settlement-reference"
                  className="block text-sm font-medium"
                >
                  Payment or simulation reference
                </label>
                <Input
                  id="settlement-reference"
                  value={reference}
                  maxLength={100}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
            )}
            <Button
              disabled={
                pending ||
                !next ||
                (needsReason && reason.trim().length < 10) ||
                (next === "settled" && (!amount || reference.trim().length < 3))
              }
              onClick={() => setConfirm(true)}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}Save
              status
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            {saved}. Update saved.
          </p>
        )}
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status update</AlertDialogTitle>
            <AlertDialogDescription>
              Move {claimNumber} from {statusLabels[status]} to{" "}
              {next ? statusLabels[next] : "the selected stage"}? The update
              will be recorded and the policyholder notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={save}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
