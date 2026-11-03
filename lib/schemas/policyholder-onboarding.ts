import { z } from "zod";

export const policyholderOnboardingSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  policyType: z.enum(["motor", "burglary"]),
  organizationId: z.string().uuid(),
});
