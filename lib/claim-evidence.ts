export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_BYTES = 150 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 20;
export const EVIDENCE_CATEGORIES = [
  "registration_certificate",
  "driving_license",
  "police_abstract",
  "scene_photos",
  "repair_estimate",
  "witness_statement",
  "entry_photos",
  "proof_of_ownership",
  "stock_records",
  "other",
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

export function evidenceCategoryApplies(
  policyType: "motor" | "burglary",
  category: string,
  premisesUse?: unknown,
): boolean {
  if (policyType === "motor")
    return [
      "registration_certificate",
      "driving_license",
      "police_abstract",
      "scene_photos",
      "repair_estimate",
      "witness_statement",
      "other",
    ].includes(category);
  return (
    ["police_abstract", "entry_photos", "proof_of_ownership", "other"].includes(
      category,
    ) ||
    (category === "stock_records" && premisesUse === "business")
  );
}

const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const MEDIA_EXTENSIONS = [...DOCUMENT_EXTENSIONS, "mp4", "mov", "webm"];
const MIME_EXTENSIONS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
  webm: ["video/webm"],
  csv: [
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export interface EvidenceFileMetadata {
  name: string;
  size: number;
  type: string;
}
export function evidenceAccept(category: string): string {
  const extensions =
    category === "stock_records"
      ? [...DOCUMENT_EXTENSIONS, "csv", "xlsx"]
      : category === "scene_photos" ||
          category === "entry_photos" ||
          category === "other"
        ? MEDIA_EXTENSIONS
        : DOCUMENT_EXTENSIONS;
  return extensions.map((extension) => `.${extension}`).join(",");
}

/** Client convenience check; the server separately verifies content and claim access. */
export function validateEvidenceSelection(
  category: string,
  file: EvidenceFileMetadata,
): string | null {
  if (!EVIDENCE_CATEGORIES.includes(category as EvidenceCategory))
    return "Choose a supported document category";
  if (!file.name.trim() || file.name.length > 255)
    return "Use a filename of 1 to 255 characters";
  if (file.size <= 0) return `${file.name} is empty`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} exceeds 50 MB`;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!evidenceAccept(category).split(",").includes(`.${extension}`))
    return `${file.name} is not an accepted file for this category`;
  if (
    file.type &&
    !MIME_EXTENSIONS[extension]?.includes(file.type.toLowerCase())
  )
    return `${file.name} has a file type that does not match its extension`;
  return null;
}

export function validateEvidenceTotals(
  files: Pick<EvidenceFileMetadata, "size">[],
): string | null {
  if (files.length > MAX_UPLOAD_FILES)
    return "Select no more than 20 files per upload batch";
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_UPLOAD_BYTES)
    return "The selected files exceed the 150 MB total limit";
  return null;
}
