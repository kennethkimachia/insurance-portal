export function claimFieldStep(path: string) {
    const first = path.split(".")[0];
    if (["incidentType", "registrationNumber", "premisesLocation", "premisesUse", "incidentTiming", "incidentDate", "incidentTime", "incidentRangeStart", "incidentRangeEnd", "discoveryDate", "discoveryTime", "incidentLocation", "description", "contactPhone"].includes(first))
        return 0;
    if (first === "pendingEvidence")
        return 2;
    return ["declarationAccepted", "privacyAccepted"].includes(first) ? 3 : 1;
}
/** Coverage is an assessment decision. Show inconsistencies without blocking first notice. */
export function policyIncidentWarning(form: {
    incidentTiming: string;
    incidentDate: string;
    incidentRangeStart: string;
    incidentRangeEnd: string;
    discoveryDate: string;
}, policy?: {
    coverageStart?: string | null;
    coverageEnd?: string | null;
    status?: string | null;
}) {
    if (!policy)
        return null;
    const start = policy.coverageStart;
    const end = policy.coverageEnd;
    if (form.incidentTiming === "unknown")
        return "The incident date is unknown. Your agent will review coverage using the available timing and evidence; the discovery date alone does not establish coverage.";
    const earliest = form.incidentTiming === "exact" ? form.incidentDate : form.incidentRangeStart;
    const latest = form.incidentTiming === "exact" ? form.incidentDate : form.incidentRangeEnd;
    if (earliest && latest && ((start && latest < start) || (end && earliest > end)))
        return "The incident dates fall outside the recorded policy dates. You can still report the incident; your agent must check the policy and applicable coverage.";
    if (earliest && latest && ((start && earliest < start) || (end && latest > end)))
        return "Part of the incident date range falls outside the recorded policy dates. Your agent will review the timing and applicable coverage.";
    if (policy.status === "cancelled" || policy.status === "expired")
        return "This policy is recorded as expired or cancelled. Coverage depends on the incident date and policy terms; your agent will review it.";
    return null;
}
