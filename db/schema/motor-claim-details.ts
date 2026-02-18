import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { claims } from "./claims";

export const motorClaimDetails = pgTable("motor_claim_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  claimId: uuid("claim_id")
    .notNull()
    .unique()
    .references(() => claims.id),

  // Vehicle
  registrationNumber: varchar("registration_number", { length: 20 }).notNull(),
  make: varchar("make", { length: 50 }).notNull(),
  model: varchar("model", { length: 50 }).notNull(),
  currentMileage: varchar("current_mileage", { length: 20 }).notNull(),

  // Driver
  driverFullName: varchar("driver_full_name", { length: 100 }).notNull(),
  licenseNumber: varchar("license_number", { length: 50 }).notNull(),
  yearsOfExperience: varchar("years_of_experience", { length: 10 }).notNull(),
  relationshipToPolicyholder: varchar("relationship_to_policyholder", {
    length: 30,
  }).notNull(),

  // Incident
  incidentDate: varchar("incident_date", { length: 20 }).notNull(),
  incidentTime: varchar("incident_time", { length: 10 }).notNull(),
  incidentLocation: text("incident_location").notNull(),
  weatherConditions: varchar("weather_conditions", { length: 30 }).notNull(),
  estimatedSpeed: varchar("estimated_speed", { length: 10 }).notNull(),

  // Police
  policeStation: varchar("police_station", { length: 100 }).notNull(),
  obNumber: varchar("ob_number", { length: 50 }).notNull(),
  reportingOfficer: varchar("reporting_officer", { length: 100 }).notNull(),

  // Damage & third-party
  damageSummary: text("damage_summary").notNull(),
  isVehicleDrivable: varchar("is_vehicle_drivable", { length: 5 }).notNull(), // "yes" | "no"
  vehicleCurrentLocation: text("vehicle_current_location").notNull(),
  thirdPartyRegistration: varchar("third_party_registration", { length: 50 }),
  thirdPartyInjuries: text("third_party_injuries"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
