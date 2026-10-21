import type {
  DocumentUploads,
  UploadedFile,
} from "@/components/claims/document-uploader";
import {
  validateEvidenceSelection,
  validateEvidenceTotals,
} from "@/lib/claim-evidence";

export interface UploadProgress {
  fileId: string;
  status: "uploading" | "uploaded" | "failed";
  progress: number;
  error?: string;
  attachmentId?: string;
}
export interface UploadOptions {
  onProgress?: (update: UploadProgress) => void;
  fileIds?: string[];
}

function uploadFile(
  claimId: string,
  organizationId: string,
  category: string,
  file: UploadedFile,
  onProgress?: UploadOptions["onProgress"],
): Promise<{ attachmentId?: string }> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", file.file, file.name);
    body.append("claimId", claimId);
    body.append("organizationId", organizationId);
    body.append("category", category);
    body.append("clientUploadId", file.id);
    if (file.lossItemId) body.append("lossItemId", file.lossItemId);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.timeout = 180000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.({
          fileId: file.id,
          status: "uploading",
          progress: Math.min(95, Math.round((event.loaded / event.total) * 95)),
        });
    };
    request.onerror = () =>
      reject(
        new Error(
          "Connection lost. Retry this file when your connection returns.",
        ),
      );
    request.ontimeout = () =>
      reject(
        new Error(
          "This upload timed out. Your report is saved; retry this file.",
        ),
      );
    request.onabort = () =>
      reject(new Error("Upload interrupted. Retry this file."));
    request.onload = () => {
      let response: {
        error?: string;
        attachmentId?: string;
        success?: boolean;
      } = {};
      try {
        response = JSON.parse(request.responseText);
      } catch {
        /* A proxy may return a non-JSON error. */
      }
      if (
        request.status < 200 ||
        request.status >= 300 ||
        response.success === false
      ) {
        reject(
          new Error(
            response.error || `Could not upload ${file.name}. Please retry.`,
          ),
        );
      } else resolve(response);
    };
    onProgress?.({ fileId: file.id, status: "uploading", progress: 0 });
    request.send(body);
  });
}

/** Retries use the same claim and clientUploadId; successful files are skipped. */
export async function uploadClaimDocuments(
  claimId: string,
  organizationId: string,
  uploads: DocumentUploads,
  options: UploadOptions = {},
) {
  const selected = Object.entries(uploads)
    .flatMap(([category, files]) => files.map((file) => ({ category, file })))
    .filter(
      ({ file }) =>
        file.status !== "uploaded" &&
        (!options.fileIds || options.fileIds.includes(file.id)),
    );
  const totalError = validateEvidenceTotals(selected.map(({ file }) => file));
  const results: Array<{ fileId: string; success: boolean; error?: string }> =
    [];
  for (const { category, file } of selected) {
    try {
      const error = totalError || validateEvidenceSelection(category, file);
      if (error) throw new Error(error);
      const response = await uploadFile(
        claimId,
        organizationId,
        category,
        file,
        options.onProgress,
      );
      options.onProgress?.({
        fileId: file.id,
        status: "uploaded",
        progress: 100,
        attachmentId: response.attachmentId,
      });
      results.push({ fileId: file.id, success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed. Please retry.";
      options.onProgress?.({
        fileId: file.id,
        status: "failed",
        progress: 0,
        error: message,
      });
      results.push({ fileId: file.id, success: false, error: message });
    }
  }
  return {
    uploaded: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}
