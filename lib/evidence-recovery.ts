import type { DocumentUploads } from "@/components/claims/document-uploader";

interface EvidenceRecord {
  id: string;
  name: string;
  size: number;
  category: string;
  clientUploadId: string | null;
  lossItemId: string | null;
  uploadState: string;
  reviewStatus: string;
}
interface EvidenceReminder {
  clientUploadId: string;
  name: string;
  size: number;
  category: string;
  lossItemId?: string;
}

/** A reselected file retries the existing reservation rather than creating another. */
export function recoverEvidenceSelections(
  next: DocumentUploads,
  records: EvidenceRecord[],
  reminders: EvidenceReminder[] = [],
): DocumentUploads {
  return Object.fromEntries(
    Object.entries(next).map(([category, files]) => [
      category,
      files.map((file) => {
        if (file.attachmentId || file.status === "uploaded") return file;
        const record = records.find(
          (item) =>
            item.category === category &&
            item.name === file.name &&
            item.size === file.size &&
            item.uploadState !== "ready" &&
            item.reviewStatus !== "waived" &&
            item.clientUploadId,
        );
        if (record)
          return {
            ...file,
            id: record.clientUploadId!,
            attachmentId: record.id,
            lossItemId: record.lossItemId ?? undefined,
          };
        const reminder = reminders.find(
          (item) =>
            item.category === category &&
            item.name === file.name &&
            item.size === file.size &&
            !records.some(
              (record) => record.clientUploadId === item.clientUploadId,
            ),
        );
        return reminder
          ? {
              ...file,
              id: reminder.clientUploadId,
              lossItemId: reminder.lossItemId,
            }
          : file;
      }),
    ]),
  );
}
