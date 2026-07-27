"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Paperclip } from "lucide-react";
import type { getClaimDetails } from "@/app/actions/agent/manage-claims";

type ClaimDetails = NonNullable<Awaited<ReturnType<typeof getClaimDetails>>>;

interface ClaimAssessmentProps {
  details: ClaimDetails | null;
}

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

export function ClaimAssessment({ details }: ClaimAssessmentProps) {
  if (!details) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Claim Assessment</CardTitle>
          <CardDescription>Select a claim to review its submitted details.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isMotor = details.policyType === "motor";
  const motor = details.motorDetails;
  const burglary = details.burglaryDetails;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Claim Assessment</CardTitle>
            <CardDescription>{details.claimNumber}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isMotor ? "default" : "secondary"}>{isMotor ? "Motor" : "Burglary"}</Badge>
            <Badge variant="outline">{details.status.replaceAll("_", " ")}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <FieldRow label="Policyholder" value={details.policyholderName} />
          <FieldRow label="Email" value={details.policyholderEmail} />
          <FieldRow label="Policy Number" value={details.policyNumber} />
          <FieldRow label="Organization" value={details.organizationName} />
          <FieldRow label="Submitted" value={new Date(details.createdAt).toLocaleString("en-KE")} />
          <FieldRow label="Claim Summary" value={details.description} />
        </section>

        {motor && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Motor Claim Details</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldRow label="Registration" value={motor.registrationNumber} />
              <FieldRow label="Vehicle" value={`${motor.make} ${motor.model}`} />
              <FieldRow label="Current Mileage" value={motor.currentMileage} />
              <FieldRow label="Driver" value={motor.driverFullName} />
              <FieldRow label="License Number" value={motor.licenseNumber} />
              <FieldRow label="Experience" value={motor.yearsOfExperience} />
              <FieldRow label="Relationship" value={motor.relationshipToPolicyholder} />
              <FieldRow label="Incident Date" value={motor.incidentDate} />
              <FieldRow label="Incident Time" value={motor.incidentTime} />
              <FieldRow label="Incident Location" value={motor.incidentLocation} />
              <FieldRow label="Weather" value={motor.weatherConditions} />
              <FieldRow label="Estimated Speed" value={motor.estimatedSpeed} />
              <FieldRow label="Police Station" value={motor.policeStation} />
              <FieldRow label="O.B. Number" value={motor.obNumber} />
              <FieldRow label="Reporting Officer" value={motor.reportingOfficer} />
              <FieldRow label="Vehicle Drivable" value={motor.isVehicleDrivable} />
              <FieldRow label="Vehicle Location" value={motor.vehicleCurrentLocation} />
              <FieldRow label="Third-Party Registration" value={motor.thirdPartyRegistration} />
              <FieldRow label="Third-Party Injuries" value={motor.thirdPartyInjuries} />
              <div className="sm:col-span-2 xl:col-span-3">
                <FieldRow label="Damage Summary" value={motor.damageSummary} />
              </div>
            </div>
          </section>
        )}

        {burglary && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Burglary Claim Details</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldRow label="Premises" value={burglary.premisesLocation} />
              <FieldRow label="Building Type" value={burglary.buildingType} />
              <FieldRow label="Anyone Home" value={burglary.wasAnyoneHome} />
              <FieldRow label="Evidence of Violence" value={burglary.evidenceOfViolence} />
              <FieldRow label="Alarm Fitted" value={burglary.alarmFitted} />
              <FieldRow label="Alarm Active" value={burglary.alarmActiveAtTime} />
              <FieldRow label="Security Firm" value={burglary.securityFirmName} />
              <FieldRow label="Police Station" value={burglary.policeStation} />
              <FieldRow label="Date Reported" value={burglary.dateReported} />
              <FieldRow label="O.B. Number" value={burglary.obNumber} />
              <div className="sm:col-span-2 xl:col-span-3">
                <FieldRow label="Entry Method" value={burglary.entryMethod} />
              </div>
              <div className="sm:col-span-2 xl:col-span-3">
                <FieldRow label="Exterior Locks" value={burglary.exteriorLockTypes} />
              </div>
            </div>
            {burglary.lossItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Loss Items</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {burglary.lossItems.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-background/70 p-3">
                      <p className="text-sm font-medium text-foreground">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Purchased {item.purchaseDate} - Original {item.originalCost} - Replacement {item.replacementValue}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Submitted Documents</h3>
          </div>
          {details.attachments.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              No documents were uploaded with this claim.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {details.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-lg border bg-background/70 p-3">
                  <p className="break-words text-sm font-medium text-foreground">{attachment.originalFilename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {attachment.contentType} - {Math.round(attachment.sizeBytes / 1024)} KB
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}