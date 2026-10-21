"use client";

import {
  IncidentReportForm,
  type IncidentReportFormProps,
} from "./incident-report-form";
export function MotorClaimForm(props: IncidentReportFormProps) {
  return <IncidentReportForm {...props} policyType="motor" />;
}
