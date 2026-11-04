const previewTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/quicktime", "video/webm"]);
export function evidencePreviewType(contentType: string): string | null {
  return previewTypes.has(contentType) ? contentType : null;
}
/** Claim authorization is checked separately. Inspection acceptance does not grant viewing access. */
export function canInspectEvidence(doc: { uploadState?: string; scanState?: string }) {
  return doc.uploadState === "ready" && ["pending", "clean"].includes(doc.scanState ?? "");
}
export function isInterruptedUpload(doc: { uploadState?: string; updatedAt?: string }, now = Date.now()) {
  return doc.uploadState === "uploading" && !!doc.updatedAt && now - Date.parse(doc.updatedAt) >= 5 * 60 * 1000;
}
export function evidenceSize(bytes: number) {
  if (!bytes) return "Size not recorded";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function evidenceReviewLabel(doc: { uploadState?: string; updatedAt?: string; scanState?: string; reviewStatus?: string }) {
  if (doc.reviewStatus === "waived") return "Waived";
  if (doc.reviewStatus === "needs_replacement") return "Replacement requested";
  if (doc.scanState === "rejected") return "File blocked";
  if (isInterruptedUpload(doc)) return "Upload interrupted";
  if (doc.uploadState === "failed") return "Upload failed";
  if (doc.uploadState === "uploading") return "Upload in progress";
  if (doc.reviewStatus === "accepted") return "Inspected · accepted";
  return "Awaiting inspection";
}
