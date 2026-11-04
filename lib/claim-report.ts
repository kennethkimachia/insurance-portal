/** Labels describe the submitted forms; free text is never rewritten. */
const sections = [
  ["Incident", ["incidentType", "description", "incidentTiming", "incidentDate", "incidentTime", "incidentRangeStart", "incidentRangeEnd", "discoveryDate", "discoveryTime", "incidentLocation", "contactPhone"]],
  ["Insured vehicle", ["registrationNumber", "make", "model", "currentMileage"]],
  ["Driver", ["driverFullName", "licenseNumber", "yearsOfExperience", "relationshipToPolicyholder"]],
  ["Damage and vehicle location", ["damageSummary", "isVehicleDrivable", "vehicleCurrentLocation", "weatherConditions", "estimatedSpeed", "repairEstimateStatus"]],
  ["People, injuries and witnesses", ["injuries", "thirdParties", "thirdPartyRegistration", "thirdPartyInjuries", "witnesses"]],
  ["Premises", ["premisesLocation", "premisesUse", "buildingType", "wasAnyoneHome"]],
  ["Entry, damage and security", ["entryMethod", "evidenceOfViolence", "premisesDamage", "alarmFitted", "alarmActiveAtTime", "securityFirmName", "exteriorLockTypes"]],
  ["Loss inventory", ["lossItems"]],
  ["Police report", ["policeReportStatus", "policeStation", "obNumber", "reportingOfficer", "dateReported"]],
  ["Declarations", ["declarationAccepted", "privacyAccepted"]],
] as const;

const labels: Record<string, string> = {
  description: "What happened", incidentTiming: "How the incident date was reported",
  incidentRangeStart: "Earliest possible incident date", incidentRangeEnd: "Latest possible incident date",
  contactPhone: "Contact telephone", registrationNumber: "Vehicle registration",
  driverFullName: "Driver’s full name", licenseNumber: "Driving licence number",
  isVehicleDrivable: "Can the vehicle be driven?", injuries: "Were any injuries reported?",
  thirdParties: "Third parties", thirdPartyRegistration: "Other vehicle registration",
  thirdPartyInjuries: "Other reported injuries", obNumber: "OB / police reference number",
  wasAnyoneHome: "Was anyone at the premises?", evidenceOfViolence: "Evidence of forcible entry",
  alarmActiveAtTime: "Was the alarm active?", exteriorLockTypes: "External locks",
  lossItems: "Items reported lost or damaged", identifyingDetails: "Identifying details / serial number",
  originalCost: "Original cost (KES)", replacementValue: "Replacement value (KES)",
  purchaseDateApproximate: "Is the purchase date approximate?", ownershipEvidence: "Evidence of ownership",
  declarationAccepted: "Accuracy declaration accepted", privacyAccepted: "Privacy acknowledgment accepted",
  estimatedSpeed: "Estimated speed (km/h)", currentMileage: "Mileage (km)",
};
const enumLabels: Record<string, string> = {
  yes: "Yes", no: "No", unknown: "Unknown", n_a: "Not applicable", not_yet: "Not yet available",
  not_available: "Not available", other_damage: "Other damage", exact: "Exact date known",
  approximate: "Approximate date range", accident: "Accident", theft: "Theft",
  residential: "Residential", business: "Business", available: "Available", reported: "Reported",
  receipt: "Receipt", valuation: "Valuation", alternative: "Alternative evidence",
};
const enumFields = new Set(["incidentType", "incidentTiming", "policeReportStatus", "isVehicleDrivable", "injuries", "repairEstimateStatus", "premisesUse", "wasAnyoneHome", "evidenceOfViolence", "alarmFitted", "alarmActiveAtTime", "ownershipEvidence"]);
const internalFields = new Set(["pendingEvidence", "itemKey", "id", "claimId", "policyId", "burglaryDetailId", "createdAt", "updatedAt"]);

export function reportFieldLabel(key: string): string {
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

export function reportValue(key: string, value: unknown): string {
  if (value == null || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  if (enumFields.has(key)) return enumLabels[String(value)] ?? String(value);
  if (["originalCost", "replacementValue"].includes(key) && /^\d+(\.\d{1,2})?$/.test(String(value)))
    return Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2 });
  return String(value);
}

export function reportEntries(report: Record<string, unknown>) {
  return Object.entries(report).filter(([key]) => !internalFields.has(key));
}

export function claimReportSections(report: Record<string, unknown>) {
  const used = new Set<string>();
  const result: { title: string; fields: { key: string; label: string; value: unknown }[] }[] = sections.map(([title, keys]) => ({
    title,
    fields: keys.filter((key) => Object.hasOwn(report, key)).map((key) => {
      used.add(key);
      return { key, label: reportFieldLabel(key), value: report[key] };
    }),
  })).filter((section) => section.fields.length);
  const extra = reportEntries(report).filter(([key]) => !used.has(key)).map(([key, value]) => ({ key, label: reportFieldLabel(key), value }));
  if (extra.length) result.push({ title: "Additional submitted answers", fields: extra });
  return result;
}
