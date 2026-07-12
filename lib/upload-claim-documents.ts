import {
  getClaimUploadUrl,
  recordClaimAttachment,
} from "@/app/actions/user/submit-claim";
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

    const { url, key } = await getClaimUploadUrl(
      claimId,
      organizationId,
      uploadedFile.name,
      uploadedFile.type,
    );
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": uploadedFile.type },
      body: uploadedFile.file,
    });

    if (!response.ok) {
      throw new Error(`Could not upload ${uploadedFile.name}`);
    }

    await recordClaimAttachment({
      claimId,
      storageKey: key,
      originalFilename: uploadedFile.name,
      contentType: uploadedFile.type,
      sizeBytes: uploadedFile.size,
    });
  }
}
