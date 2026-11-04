import { Zip, ZipPassThrough, strToU8 } from "fflate";
import { createHash } from "node:crypto";
import { exportDocuments, renderClaimExport, type ClaimExportData, type ExportDocument } from "./claim-export-report";

// fflate emits standard ZIP (not ZIP64). Leave room for headers and report text.
const MAX_PACKAGE_BYTES = 0xf0000000;
export function assertPackageSize(documents: ClaimExportData["documents"]) {
  const included = exportDocuments(documents).filter((doc) => doc.path);
  if (included.length > 60_000 || included.reduce((sum, doc) => sum + doc.size, 0) > MAX_PACKAGE_BYTES)
    throw new Error("This claim exceeds the supported ZIP package size. Contact support to export its documents.");
}

export async function* verifiedDocumentBytes(source: AsyncIterable<Uint8Array>, expectedSize: number | null, expectedHash: string | null) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const bytes of source) {
    size += bytes.byteLength;
    if (size > MAX_PACKAGE_BYTES || (expectedSize !== null && size > expectedSize))
      throw new Error("Document size changed during export. Retry the export.");
    hash.update(bytes);
    yield bytes;
  }
  if (expectedSize !== null && size !== expectedSize) throw new Error("Document download was incomplete. Retry the export.");
  if (expectedHash && hash.digest("hex") !== expectedHash.toLowerCase()) throw new Error("Document verification failed. Retry the export.");
}

export type ExportDocumentLoader = (document: ExportDocument, signal: AbortSignal) => AsyncIterable<Uint8Array>;

/** Pull-based ZIP: only the current storage chunk is held in server memory. */
export function createClaimPackage(data: ClaimExportData, loadDocument: ExportDocumentLoader, exportedAt = new Date().toISOString(), requestSignal?: AbortSignal) {
  assertPackageSize(data.documents);
  const documents = exportDocuments(data.documents);
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  if (requestSignal?.aborted) abort.abort();
  requestSignal?.addEventListener("abort", onAbort, { once: true });
  async function* archive() {
    const output: Uint8Array[] = [];
    const zip = new Zip((error, chunk) => {
      if (error) throw error;
      output.push(chunk);
    });
    let total = 0;
    async function* add(path: string, source: AsyncIterable<Uint8Array>) {
      const file = new ZipPassThrough(path);
      zip.add(file);
      for await (const bytes of source) {
        if (abort.signal.aborted) throw new Error("Export cancelled.");
        total += bytes.byteLength;
        if (total > MAX_PACKAGE_BYTES) throw new Error("Claim package exceeds the supported ZIP size.");
        file.push(bytes);
        yield* output.splice(0);
      }
      file.push(new Uint8Array(), true);
      yield* output.splice(0);
    }
    async function* content(value: string) { yield strToU8(value); }
    try {
      if (abort.signal.aborted) throw new Error("Export cancelled.");
      yield* add("report.html", content(renderClaimExport(data, documents, exportedAt)));
      yield* add("README.txt", content([
        `CLAIM REPORT: ${data.claim.claimNumber}`,
        `Exported: ${exportedAt}`,
        data.role === "user" ? "Policyholder copy: shared claim record." : "CONFIDENTIAL: internal review copy, including internal findings and correspondence.",
        "",
        "1. Extract the entire ZIP package.",
        "2. Open report.html in any web browser. No portal account or internet connection is needed.",
        "3. Use the document links to open originals in the documents folder.",
        "4. Use the browser Print / Save as PDF command to save a printable report.",
        "5. Forward the complete ZIP to include the original documents; a printed PDF contains the document index only.",
        "",
        `${documents.filter((doc) => doc.path).length} original file(s) included.`,
        ...documents.filter((doc) => !doc.path).map((doc) => `${doc.reference}: ${doc.name} — EXCLUDED: ${doc.exclusion}`),
        "",
        "This report is a snapshot of recorded information. See the decision source, recommendations and settlement references before treating a record as an external decision or payment.",
      ].join("\r\n")));
      for (const document of documents) {
        if (document.path) yield* add(document.path, loadDocument(document, abort.signal));
      }
      zip.end();
      yield* output.splice(0);
    } finally {
      abort.abort();
      zip.terminate();
      requestSignal?.removeEventListener("abort", onAbort);
    }
  }
  const iterator = archive();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await iterator.next();
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      abort.abort();
      await iterator.return(undefined);
    },
  });
}
