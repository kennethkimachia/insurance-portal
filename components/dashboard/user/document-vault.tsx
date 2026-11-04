"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText, Files, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canInspectEvidence, evidencePreviewType, evidenceReviewLabel, evidenceSize, isInterruptedUpload } from "@/lib/evidence-presentation";
import { recoverClaimUpload } from "@/app/actions/agent/recover-claim-upload";
import type { ClaimWorkspaceData } from "@/components/claims/claim-workspace";

type ClaimDocument = ClaimWorkspaceData["documents"][number];

export function DocumentVault({ documents, claimId, staff = false, demo = false, active = true, renderReview }: {
  documents: ClaimDocument[];
  claimId: string;
  staff?: boolean;
  demo?: boolean;
  active?: boolean;
  renderReview?: (doc: ClaimDocument) => ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(documents.find((doc) => canInspectEvidence(doc))?.id ?? documents[0]?.id);
  const selected = documents.find((doc) => doc.id === selectedId) ?? documents[0];
  const received = documents.filter((doc) => doc.uploadState === "ready").length;
  return <section id="documents" className="space-y-5 scroll-mt-24">
    <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Files className="size-5 text-primary" />Claim evidence</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{received} of {documents.length} files received. Select a file to inspect its contents{staff ? " and record your review" : ""}.</p></div>
    {!documents.length ? <div className="portal-empty">No evidence files have been received. The submitted claim form is available in the Claim form tab.</div> : <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-xl border bg-card"><div className="border-b px-4 py-3 text-sm font-semibold">Evidence files</div><ul aria-label="Claim documents" className="max-h-72 divide-y overflow-auto lg:max-h-[650px]">{documents.map((doc) => <li key={doc.id}><button type="button" onClick={() => setSelectedId(doc.id)} aria-pressed={selected?.id === doc.id} className={`w-full border-l-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${selected?.id === doc.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"}`}>
        <span className="block break-words text-sm font-semibold leading-6">{doc.name}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{doc.category.replaceAll("_", " ")} · {evidenceSize(doc.size)}</span><Badge variant={doc.uploadState === "failed" || isInterruptedUpload(doc) || doc.scanState === "rejected" ? "outline" : "secondary"} className="mt-2 whitespace-normal text-left">{evidenceReviewLabel(doc)}</Badge>
      </button></li>)}</ul></div>
      {selected && <div className="min-w-0 space-y-5"><EvidenceViewer key={`${selected.id}:${selected.uploadState}`} doc={selected} claimId={claimId} staff={staff} demo={demo} active={active} />
        {selected.reviewNote && <div className="rounded-xl border bg-card p-5"><h3 className="text-sm font-semibold">Recorded inspection</h3><p className="mt-2 whitespace-pre-wrap text-base leading-7">{selected.reviewNote}</p></div>}
        {renderReview && <section id="document-review" className="scroll-mt-24">{renderReview(selected)}</section>}
      </div>}
    </div>}
  </section>;
}

function EvidenceViewer({ doc, claimId, staff, demo, active }: { doc: ClaimDocument; claimId: string; staff: boolean; demo: boolean; active: boolean }) {
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [recovering, startRecovery] = useTransition();
  const router = useRouter();
  const available = canInspectEvidence(doc);
  const previewable = !!evidencePreviewType(doc.type);
  const download = `/api/claims/${claimId}/attachments/${doc.id}`;
  useEffect(() => {
    if (!active || demo || !available || !previewable) return;
    const controller = new AbortController();
    fetch(`${download}?preview=1`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Could not load this document.");
      if (!controller.signal.aborted) { setPreview({ url: data.url, type: data.contentType }); setError(""); }
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load this document.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, demo, available, previewable, download, attempt]);
  function reloadPreview() {
    setLoading(true);
    setError("");
    setPreview(null);
    setAttempt((value) => value + 1);
  }
  function recover() {
    startRecovery(async () => {
      try {
        const result = await recoverClaimUpload(claimId, doc.id);
        if (!result.success) setError(result.error || "Could not recover the file.");
        else { setError(""); router.refresh(); }
      } catch { setError("Could not check the stored file. Please retry."); }
    });
  }
  return <div className="overflow-hidden rounded-xl border bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div className="min-w-0"><h3 className="break-words text-base font-semibold">{doc.name}</h3><p className="mt-1 text-sm text-muted-foreground">{evidenceSize(doc.size)} · Added {new Date(doc.uploadedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" })}</p></div>
      {available && !demo && <div className="flex flex-wrap gap-2">{preview && <Button asChild size="sm" variant="outline"><a href={preview.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink />Open full size</a></Button>}<Button asChild size="sm" variant="outline"><a href={download} target="_blank" rel="noopener noreferrer"><Download />Download</a></Button></div>}
    </div>
    {doc.scanState === "pending" && doc.uploadState === "ready" && <p className="border-b bg-amber-500/5 px-5 py-3 text-sm">{staff ? "Awaiting manual inspection. This file has not been malware scanned." : "Received and awaiting inspection by your claims team. You can view or download your document while the review is pending."}</p>}
    {demo ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground"><FileText className="size-10" /><p>Synthetic evidence · no file is stored in this preview.</p></div> : !available ? <div className="space-y-4 p-6">
      <h4 className="text-base font-semibold">{evidenceReviewLabel(doc)}</h4><p className="text-base leading-7 text-muted-foreground">{doc.scanState === "rejected" ? "This file is blocked and cannot be opened. Request a replacement." : doc.uploadState === "failed" || isInterruptedUpload(doc) ? "The upload did not finish registering. Check whether the original file reached storage before uploading it again." : doc.uploadState === "uploading" ? "The file is still uploading. Refresh the claim after it finishes." : "This document is awaiting review by your claims team."}</p>
      {(doc.uploadState === "failed" || isInterruptedUpload(doc)) && <><Button variant="outline" disabled={recovering} onClick={recover}>{recovering ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Check stored file</Button><p className="text-sm text-muted-foreground">If recovery is unavailable, select the original file under “Add documents or retry an upload” below.</p></>}
      {doc.uploadState === "uploading" && !isInterruptedUpload(doc) && <Button variant="outline" onClick={() => router.refresh()}><RotateCcw />Refresh file status</Button>}
    </div> : !previewable ? <p className="p-8 text-base leading-7 text-muted-foreground">A preview is unavailable for this file type. Download the original to inspect it.</p> : <>
      {loading && <p role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Loading document…</p>}
      {preview && !error && <>
        {preview.type.startsWith("image/") && <><div className="flex items-center justify-end gap-2 border-b px-4 py-2"><Button variant="ghost" size="sm" aria-label="Zoom out" disabled={zoom <= 100} onClick={() => setZoom((value) => value - 25)}><ZoomOut /></Button><span className="text-sm tabular-nums">{zoom}%</span><Button variant="ghost" size="sm" aria-label="Zoom in" disabled={zoom >= 300} onClick={() => setZoom((value) => value + 25)}><ZoomIn /></Button></div><div className="max-h-[75vh] overflow-auto bg-muted/50 p-3">
          {/* Native image keeps the private, expiring URL out of image optimization caches. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={doc.name} referrerPolicy="no-referrer" className="block h-auto max-w-none" style={{ width: `${zoom}%` }} onError={() => setError("The image could not be loaded. Reload the preview or download the original.")} />
        </div></>}
        {preview.type === "application/pdf" && <iframe title={`Document: ${doc.name}`} src={preview.url} className="h-[75vh] min-h-96 w-full bg-muted" sandbox="allow-scripts allow-same-origin allow-downloads" referrerPolicy="no-referrer" />}
        {preview.type.startsWith("video/") && <video controls preload="metadata" src={preview.url} className="max-h-[75vh] w-full bg-black" onError={() => setError("This video cannot be played in your browser. Download the original to inspect it.")} />}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3"><p className="text-xs text-muted-foreground">Private preview · access link expires after 5 minutes.</p><Button variant="ghost" size="sm" onClick={reloadPreview}><RotateCcw />Reload preview</Button></div>
      </>}
    </>}
    {error && <div role="alert" className="space-y-3 border-t p-5"><p className="text-sm leading-6 text-destructive">{error}</p>{available && previewable && <Button variant="outline" size="sm" onClick={reloadPreview}>Retry preview</Button>}</div>}
  </div>;
}
