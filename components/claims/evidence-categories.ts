import type { DocumentCategory } from "./document-uploader";

export const MOTOR_EVIDENCE_CATEGORIES: DocumentCategory[] = [
  {
    key: "registration_certificate",
    label: "Vehicle registration",
    description: "Registration document or logbook, when available.",
    multiple: false,
  },
  {
    key: "driving_license",
    label: "Driving licence",
    description: "Relevant for an accident involving a driver.",
    multiple: false,
  },
  {
    key: "police_abstract",
    label: "Police report",
    description:
      "Police abstract or reporting acknowledgment. You can add it later.",
    multiple: true,
  },
  {
    key: "scene_photos",
    label: "Incident photos or video",
    description: "Available photos of the scene, vehicle or damage.",
    multiple: true,
  },
  {
    key: "repair_estimate",
    label: "Repair estimate",
    description:
      "An estimate if you have one. Reporting does not require repairs to start.",
    multiple: true,
  },
  {
    key: "witness_statement",
    label: "Witness statement",
    description: "Written statements or relevant witness information.",
    multiple: true,
  },
  {
    key: "other",
    label: "Other evidence",
    description: "Other relevant documents, photos or video.",
    multiple: true,
  },
];

export function burglaryEvidenceCategories(
  premisesUse?: string,
): DocumentCategory[] {
  const categories: DocumentCategory[] = [
    {
      key: "police_abstract",
      label: "Police report",
      description:
        "Police abstract or reporting acknowledgment, when available.",
      multiple: true,
    },
    {
      key: "entry_photos",
      label: "Entry or damage photos",
      description:
        "Photos or video of entry points and damage to the premises.",
      multiple: true,
    },
    {
      key: "proof_of_ownership",
      label: "Ownership evidence",
      description:
        "Receipts, valuations, bank statements, photos or other ownership evidence are alternatives. A receipt is not required.",
      multiple: true,
    },
  ];
  if (premisesUse === "business")
    categories.push({
      key: "stock_records",
      label: "Business stock records",
      description:
        "Relevant stock records as PDF, images, CSV or XLSX. Business premises only.",
      multiple: true,
    });
  categories.push({
    key: "other",
    label: "Other evidence",
    description: "Other relevant documents, photos or video.",
    multiple: true,
  });
  return categories;
}
