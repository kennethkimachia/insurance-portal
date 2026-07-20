import { recordClaimAttachment } from "@/app/actions/user/submit-claim";
import type { DocumentUploads } from "@/components/claims/document-uploader";

export async function uploadClaimDocuments(
  claimId: string,
  organizationId: string,
  uploads: DocumentUploads,
) {
  const files = Object.values(uploads).flat();

  for (const uploadedFile of files) {
    if (uploadedFile.size > 50 * 1024 * 1024) {
      throw new Error(`${uploadedFile.name} exceeds the 50 MB upload limit`);
    }

    // Upload via our server-side proxy to avoid B2 CORS issues
    const formData = new FormData();
    formData.append("file", uploadedFile.file, uploadedFile.name);
    formData.append("claimId", claimId);
    formData.append("organizationId", organizationId);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Could not upload ${uploadedFile.name}`);
    }

    const { key } = await response.json();

    await recordClaimAttachment({
      claimId,
      storageKey: key,
      originalFilename: uploadedFile.name,
      contentType: uploadedFile.type,
      sizeBytes: uploadedFile.size,
    });
  }
}

