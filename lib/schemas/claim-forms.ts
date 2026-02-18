import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { motorClaimDetails } from "@/db/schema/motor-claim-details";
import {
  burglaryClaimDetails,
  burglaryLossItems,
} from "@/db/schema/burglary-claim-details";

// ── Motor Insurance Claim ────────────────────────────────────────────────

export const motorClaimSchema = createInsertSchema(motorClaimDetails, {
  registrationNumber: (s) => s.min(1, "Registration number is required"),
  make: (s) => s.min(1, "Vehicle make is required"),
  model: (s) => s.min(1, "Vehicle model is required"),
  currentMileage: (s) => s.min(1, "Current mileage is required"),
  driverFullName: (s) => s.min(1, "Driver's full name is required"),
  licenseNumber: (s) => s.min(1, "License number is required"),
  yearsOfExperience: (s) => s.min(1, "Years of experience is required"),
  relationshipToPolicyholder: (s) =>
    s.min(1, "Relationship to policyholder is required"),
  incidentDate: (s) => s.min(1, "Incident date is required"),
  incidentTime: (s) => s.min(1, "Incident time is required"),
  incidentLocation: (s) => s.min(1, "Location (road or town) is required"),
  weatherConditions: (s) => s.min(1, "Weather conditions is required"),
  estimatedSpeed: (s) => s.min(1, "Estimated speed is required"),
  policeStation: (s) => s.min(1, "Police station is required"),
  obNumber: (s) => s.min(1, "O.B. Number is required"),
  reportingOfficer: (s) => s.min(1, "Reporting officer name is required"),
  damageSummary: (s) =>
    s.min(10, "Please provide a detailed damage summary (at least 10 characters)"),
  isVehicleDrivable: (s) =>
    s.min(1, "Please indicate if the vehicle is still drivable"),
  vehicleCurrentLocation: (s) =>
    s.min(1, "Vehicle's current location is required"),
}).omit({
  id: true,
  claimId: true,
  createdAt: true,
});

export type MotorClaimFormData = z.infer<typeof motorClaimSchema>;

// ── Burglary Insurance Claim ─────────────────────────────────────────────

const lossItemSchema = createInsertSchema(burglaryLossItems, {
  description: (s) => s.min(1, "Item description is required"),
  purchaseDate: (s) => s.min(1, "Purchase date is required"),
  originalCost: (s) => s.min(1, "Original cost is required"),
  replacementValue: (s) => s.min(1, "Replacement value is required"),
}).omit({
  id: true,
  burglaryDetailId: true,
});

export const burglaryClaimSchema = createInsertSchema(burglaryClaimDetails, {
  premisesLocation: (s) =>
    s.min(1, "Premises location (plot/street number) is required"),
  buildingType: (s) => s.min(1, "Building type is required"),
  wasAnyoneHome: (s) => s.min(1, "Please indicate if anyone was home"),
  entryMethod: (s) =>
    s.min(5, "Describe how entry was made (at least 5 characters)"),
  evidenceOfViolence: (s) =>
    s.min(1, "Please indicate if there was evidence of physical violence"),
  alarmFitted: (s) => s.min(1, "Please indicate if an alarm was fitted"),
  alarmActiveAtTime: (s) =>
    s.min(1, "Please indicate if the alarm was active"),
  exteriorLockTypes: (s) =>
    s.min(1, "Describe the types of locks on exterior doors"),
  policeStation: (s) => s.min(1, "Police station is required"),
  dateReported: (s) => s.min(1, "Date reported is required"),
  obNumber: (s) => s.min(1, "O.B. Number is required"),
})
  .omit({
    id: true,
    claimId: true,
    createdAt: true,
  })
  .extend({
    lossItems: z
      .array(lossItemSchema)
      .min(1, "At least one stolen item must be listed"),
  });

export type BurglaryClaimFormData = z.infer<typeof burglaryClaimSchema>;
export type LossItem = z.infer<typeof lossItemSchema>;
