"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ExportClaimButton({ claimId, claimNumber }: { claimId: string; claimNumber: string }) {
  const [exporting, setExporting] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function download() {
    if (active.current) return;
    const abort = new AbortController();
    active.current = abort;
    setExporting(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/export`, { signal: abort.signal, cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Could not export this claim. Please retry.");
      }
      if (!response.headers.get("Content-Type")?.startsWith("application/zip"))
        throw new Error("Your session may have expired. Refresh the page and retry the export.");
      // Wait for all originals before offering a download. A failed storage read
      // interrupts the response and cannot leave an apparently complete package.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${claimNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}-claim-report.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Claim package downloaded. Extract the ZIP and open report.html to review or print it.");
    } catch (error) {
      if (!abort.signal.aborted) toast.error(error instanceof TypeError ? "The claim package could not finish downloading. Check your connection and document availability, then retry." : error instanceof Error ? error.message : "Could not export this claim. Please retry.");
    } finally {
      active.current = null;
      setExporting(false);
    }
  }

  return <Button variant="outline" onClick={download} disabled={exporting} aria-busy={exporting}>
    {exporting ? <Loader2 className="animate-spin" /> : <Download />}
    {exporting ? "Preparing claim package…" : "Export claim package"}
  </Button>;
}
