"use client";

import { useState } from "react";
import { MotorClaimForm } from "@/components/claims/motor-claim-form";
import { BurglaryClaimForm } from "@/components/claims/burglary-claim-form";
import { Car, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PolicyType = "motor" | "burglary";

const POLICY_TYPES: {
  key: PolicyType;
  label: string;
  icon: typeof Car;
  description: string;
}[] = [
  {
    key: "motor",
    label: "Motor Insurance",
    icon: Car,
    description: "Report a motor accident, theft, or vehicle damage",
  },
  {
    key: "burglary",
    label: "Burglary Insurance",
    icon: Building2,
    description: "Report a break-in, stolen property, or premises damage",
  },
];

export default function ClaimsPage() {
  const [selected, setSelected] = useState<PolicyType | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            File a New Claim
          </h1>
          <p className="mt-1 text-muted-foreground">
            Select your policy type to begin filing a claim.
          </p>
        </div>

        {/* Policy type selector */}
        {!selected ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {POLICY_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.key}
                  onClick={() => setSelected(type.key)}
                  className="group flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10">
                    <Icon className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {type.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back to selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelected(null)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Change policy type
              </button>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
                {selected === "motor" ? (
                  <Car className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="text-xs font-medium text-primary">
                  {selected === "motor" ? "Motor" : "Burglary"}
                </span>
              </div>
            </div>

            {/* Form */}
            {selected === "motor" ? <MotorClaimForm /> : <BurglaryClaimForm />}
          </div>
        )}
      </div>
    </div>
  );
}
