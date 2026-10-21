"use client";

import {
  IncidentReportForm,
  type IncidentReportFormProps,
} from "./incident-report-form";
export function BurglaryClaimForm(props: IncidentReportFormProps) {
  return <IncidentReportForm {...props} policyType="burglary" />;
}
