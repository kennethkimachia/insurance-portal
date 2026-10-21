"use client";

import { useCallback, useEffect, useState } from "react";
import { saveClaimDraft } from "@/app/actions/user/submit-claim";
import { ClaimDraftSaveQueue } from "@/lib/claim-draft-client";
import type { ClaimFormData } from "@/lib/schemas/claim-forms";

export interface ResumableClaimDraft {
  claimId: string;
  claimNumber: string;
  savedAt: string;
  formData: unknown;
}

export function useClaimDraft<T extends ClaimFormData>({
  policyId,
  policyType,
  formData,
  initialDraft,
  initialClaimId,
  paused,
  hasLocalFiles,
  demo = false,
}: {
  policyId?: string;
  policyType: "motor" | "burglary";
  formData: T;
  initialDraft?: ResumableClaimDraft;
  initialClaimId?: string;
  paused?: boolean;
  hasLocalFiles?: boolean;
  demo?: boolean;
}) {
  const [queue] = useState(
    () =>
      new ClaimDraftSaveQueue<T>(
        (data, claimId) => {
          if (demo)
            return Promise.resolve({
              success: true,
              claimId,
              claimNumber: "PREVIEW DRAFT",
              savedAt: new Date().toISOString(),
            });
          if (!policyId)
            return Promise.resolve({
              success: false,
              error:
                "Select an enrolled policy before saving or reporting an incident",
            });
          return saveClaimDraft({
            policyId,
            policyType,
            claimId,
            formData: data,
          });
        },
        initialDraft?.claimId ?? initialClaimId,
        initialDraft ? formData : undefined,
      ),
  );
  const [lastSavedForm, setLastSavedForm] = useState(JSON.stringify(formData));
  const [claimId, setClaimId] = useState(queue.claimId);
  const [claimNumber, setClaimNumber] = useState(initialDraft?.claimNumber);
  const [savedAt, setSavedAt] = useState(initialDraft?.savedAt);
  const [savingCount, setSavingCount] = useState(0);
  const [saveError, setSaveError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const serialized = JSON.stringify(formData);
  const isDirty = !submitted && lastSavedForm !== serialized;

  const saveNow = useCallback(async () => {
    const snapshot = formData;
    if (!demo) {
      const url = new URL(window.location.href);
      url.searchParams.set("draft", queue.claimId);
      if (policyId) url.searchParams.set("policy", policyId);
      window.history.replaceState(window.history.state, "", url);
    }
    setSavingCount((count) => count + 1);
    const result = await queue.save(snapshot);
    setSavingCount((count) => count - 1);
    if (result.success && result.claimId) {
      setClaimId(result.claimId);
      setClaimNumber(result.claimNumber);
      setSavedAt(
        result.savedAt
          ? new Date(result.savedAt).toISOString()
          : new Date().toISOString(),
      );
      setLastSavedForm(JSON.stringify(snapshot));
      setSaveError(undefined);
    } else
      setSaveError(result.error || "Draft could not be saved. Please retry.");
    return result;
  }, [demo, formData, policyId, queue]);

  useEffect(() => {
    if (!isDirty || paused || submitted) return;
    const timer = window.setTimeout(() => {
      void saveNow();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isDirty, paused, saveNow, submitted]);

  useEffect(() => {
    if (!isDirty && !hasLocalFiles) return;
    const message = hasLocalFiles
      ? "Selected documents have not been uploaded. You will need to select them again if you leave. Leave this page?"
      : "Some changes have not been saved yet. Leave this page?";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigation = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      )
        return;
      const destination = new URL(target.href, window.location.href);
      if (
        destination.href === window.location.href ||
        (destination.hash && destination.pathname === window.location.pathname)
      )
        return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigation, true);
    };
  }, [hasLocalFiles, isDirty, submitted]);

  function markSubmitted() {
    queue.stop();
    setSubmitted(true);
  }
  return {
    claimId,
    claimNumber,
    savedAt,
    isDirty,
    isSaving: savingCount > 0,
    saveError,
    saveNow,
    markSubmitted,
  };
}
