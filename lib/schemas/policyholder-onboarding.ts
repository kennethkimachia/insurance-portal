import { z } from "zod";
import { normalizedPhone } from "../invitation-policy";
import { policyProfileSchema } from "./policy-profile";

export const policyholderOnboardingSchema = policyProfileSchema.safeExtend({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  phone: z.string().transform(normalizedPhone).refine((value) => value !== null, "Use a valid contact number including the country code."),
  policyType: z.enum(["motor", "burglary"]),
  organizationId: z.string().uuid(),
  policyConfirmed: z.literal(true, { error: "Confirm that you checked the policy and the invited holder's details." }),
});
