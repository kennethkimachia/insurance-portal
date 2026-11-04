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
  assessmentSummary?: string | null;
}

export function StatusEditor({
  claimNumber,
  currentStatus,
  claimId,
  role = "agent",
  onStatusChange,
  assessmentSummary,
}: StatusEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [next, setNext] = useState<ClaimStatus | "">("");
  const [reason, setReason] = useState("");
  const [assessment, setAssessment] = useState(assessmentSummary ?? "");
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
          { source, settlementAmount: amount, settlementReference: reference, ...(next === "rejected" ? { assessmentSummary: assessment } : {}) },
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
        <CardTitle className="text-lg">Claim decision & next stage</CardTitle>
        <CardDescription>
          {claimNumber} · {statusLabels[status]}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{role === "head_agent" || role === "admin" ? "Record the claim decision here. Rejecting requires assessment findings and an explanation to the policyholder; the decision also closes outstanding work." : "Agents record work and recommendations. A claims manager or administrator must approve or reject the claim."}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={pending || !transitions.includes("rejected")} onClick={() => { setNext("rejected"); setError(null); }}>Reject claim</Button>
          <Button variant="outline" disabled={pending || !transitions.includes("approved")} onClick={() => { setNext("approved"); setError(null); }}>Approve claim</Button>
        </div>
        {!transitions.includes("approved") && !["approved", "settled", "rejected", "withdrawn"].includes(status) && <p className="text-sm text-muted-foreground">Approval becomes available to a manager after the assessment is complete and evidence requests and inspections are resolved.</p>}
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
            <details>
            <summary className="cursor-pointer text-sm font-medium text-primary">Other claim actions{next ? ` · ${statusLabels[next]}` : ""}</summary>
            <label htmlFor="next-status" className="mt-3 block text-sm font-medium">Choose an action</label>
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
            </details>
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
            {next === "rejected" && <div className="space-y-3"><label htmlFor="decision-assessment" className="block text-sm font-medium">Assessment findings supporting rejection (staff only)</label><Textarea id="decision-assessment" value={assessment} onChange={(event) => setAssessment(event.target.value)} minLength={20} maxLength={5000} rows={5} /><p className="text-sm text-muted-foreground">Describe the evidence and basis for the decision. The explanation to the policyholder above is published with the rejection.</p></div>}
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
                (next === "rejected" && assessment.trim().length < 20) ||
                (next === "settled" && (!amount || reference.trim().length < 3))
              }
              onClick={() => setConfirm(true)}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}{next === "rejected" ? "Review rejection" : next === "approved" ? "Review approval" : "Review next action"}
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
            <AlertDialogTitle>{next === "rejected" ? "Confirm claim rejection" : "Confirm claim action"}</AlertDialogTitle>
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
