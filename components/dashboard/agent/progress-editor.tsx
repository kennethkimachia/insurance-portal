"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  addProgressStep,
  completeProgressStep,
  uncompleteProgressStep,
  removeProgressStep,
} from "@/app/actions/agent/progress-steps";

interface ProgressStep {
  id: string;
  claimId: string;
  stepOrder: number;
  label: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
}

interface ProgressEditorProps {
  claimId: string;
  claimNumber: string;
  initialSteps: ProgressStep[];
}

export function ProgressEditor({
  claimId,
  claimNumber,
  initialSteps,
}: ProgressEditorProps) {
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionStepId, setActionStepId] = useState<string | null>(null);

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progress =
    steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  function handleAddStep() {
    if (!newLabel.trim()) return;

    startTransition(async () => {
      const result = await addProgressStep(
        claimId,
        newLabel,
        newDescription || undefined
      );
      if (result.success && result.step) {
        setSteps((prev) => [...prev, result.step as ProgressStep]);
        setNewLabel("");
        setNewDescription("");
        setShowAddForm(false);
      }
    });
  }

  function handleToggleStep(stepId: string, isCurrentlyCompleted: boolean) {
    setActionStepId(stepId);
    startTransition(async () => {
      if (isCurrentlyCompleted) {
        const result = await uncompleteProgressStep(stepId);
        if (result.success) {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === stepId
                ? { ...s, isCompleted: false, completedAt: null, completedBy: null }
                : s
            )
          );
        }
      } else {
        const result = await completeProgressStep(stepId);
        if (result.success) {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === stepId
                ? {
                    ...s,
                    isCompleted: true,
                    completedAt: new Date().toISOString(),
                  }
                : s
            )
          );
        }
      }
      setActionStepId(null);
    });
  }

  function handleRemoveStep(stepId: string) {
    setActionStepId(stepId);
    startTransition(async () => {
      const result = await removeProgressStep(stepId);
      if (result.success) {
        setSteps((prev) => prev.filter((s) => s.id !== stepId));
      }
      setActionStepId(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Claim Progress</CardTitle>
            <CardDescription>
              {claimNumber} · {completedCount} of {steps.length} steps complete
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="relative">
          <div className="h-2.5 w-full rounded-full bg-muted">
            <div
              className="h-2.5 rounded-full bg-primary transition-all duration-700 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`group flex items-start gap-3 rounded-lg border p-3 transition-all ${
                step.isCompleted
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-border hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              {/* Step indicator line */}
              <div className="flex flex-col items-center pt-0.5">
                <button
                  onClick={() => handleToggleStep(step.id, step.isCompleted)}
                  disabled={isPending && actionStepId === step.id}
                  className="shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                >
                  {isPending && actionStepId === step.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : step.isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`mt-1 w-px flex-1 ${
                      step.isCompleted ? "bg-emerald-500/30" : "bg-border"
                    }`}
                    style={{ minHeight: "12px" }}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.isCompleted
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-foreground"
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
                    {new Date(step.completedAt).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {/* Remove button (only for incomplete steps) */}
              {!step.isCompleted && (
                <button
                  onClick={() => handleRemoveStep(step.id)}
                  disabled={isPending && actionStepId === step.id}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add step form */}
        {showAddForm && (
          <div className="animate-in slide-in-from-top-2 space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Step Label
              </label>
              <Input
                placeholder="e.g. Surveyor assessment scheduled"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="Additional details about this step..."
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAddStep}
                disabled={!newLabel.trim() || isPending}
                className="gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add Step
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLabel("");
                  setNewDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {steps.length === 0 && !showAddForm && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No progress steps yet. Add steps to track this claim&apos;s journey
              through the insurance carrier&apos;s process.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
