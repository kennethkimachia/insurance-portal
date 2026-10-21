import { z } from "zod";
import { isCalendarDate } from "./claim-forms";

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => !value || isCalendarDate(value),
    "Use a valid calendar date.",
  );
export const policyProfileSchema = z
  .object({
    status: z.enum(["active", "expired", "cancelled", "unknown"]),
    source: z.enum(["manual", "demo"]),
    insurerReference: z.string().trim().max(100),
    coverageStart: optionalDate,
    coverageEnd: optionalDate,
    insuredAsset: z.string().trim().min(3).max(500),
    coverageSummary: z.string().trim().min(5).max(2000),
  })
  .superRefine((data, ctx) => {
    if (
      data.coverageStart &&
      data.coverageEnd &&
      data.coverageEnd < data.coverageStart
    )
      ctx.addIssue({
        code: "custom",
        path: ["coverageEnd"],
        message: "Coverage end must be on or after its start.",
      });
    if (
      data.source === "manual" &&
      (!data.insurerReference || !data.coverageStart || !data.coverageEnd)
    )
      ctx.addIssue({
        code: "custom",
        path: ["insurerReference"],
        message:
          "A manual profile requires an insurer reference and coverage dates.",
      });
  });
export type PolicyProfileInput = z.input<typeof policyProfileSchema>;
