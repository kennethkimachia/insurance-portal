"use client";

import { useState } from "react";
import { MotorClaimForm } from "@/components/claims/motor-claim-form";
import { BurglaryClaimForm } from "@/components/claims/burglary-claim-form";
import { Car, Building2 } from "lucide-react";

type PolicyType = "motor" | "burglary";

interface Policy {
  id: string;
  policyNumber: string;
  policyType: string;
  organizationName: string;
}

interface ClaimsPageClientProps {
  policies: Policy[];
}

export default function ClaimsPageClient({ policies }: ClaimsPageClientProps) {
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  // Filter policies of the selected type
  const filteredPolicies = policies.filter(
    (p) => p.policyType === selectedType
  );

  function handleSelectType(type: PolicyType) {
    setSelectedType(type);
    const typedPolicies = policies.filter((p) => p.policyType === type);
    if (typedPolicies.length === 1) {
      setSelectedPolicyId(typedPolicies[0].id);
    } else {
      setSelectedPolicyId(null);
    }
  }

  function handleBack() {
    setSelectedType(null);
    setSelectedPolicyId(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            File a New Claim
          </h1>
          <p className="mt-1 text-muted-foreground">
            Select your policy type and policy to begin filing a claim.
          </p>
        </div>

        {/* Policy type selector */}
        {!selectedType ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => handleSelectType("motor")}
              className="group flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10">
                <Car className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Motor Insurance
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Report a motor accident, theft, or vehicle damage
                </p>
              </div>
            </button>

            <button
              onClick={() => handleSelectType("burglary")}
              className="group flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10">
                <Building2 className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Burglary Insurance
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Report a break-in, stolen property, or premises damage
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Back to selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Change policy type
              </button>
              <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
                {selectedType === "motor" ? (
                  <Car className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="text-xs font-medium text-primary">
                  {selectedType === "motor" ? "Motor" : "Burglary"}
                </span>
              </div>
            </div>

            {/* Policy selection if multiple policies exist of the same type */}
            {filteredPolicies.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                <p className="text-sm font-medium text-destructive">
                  No active policy found
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You do not have an active {selectedType} policy registered.
                  Please contact your agent to get onboarded first.
                </p>
              </div>
            ) : filteredPolicies.length > 1 && !selectedPolicyId ? (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-semibold text-foreground">
                  Select Policy Number
                </h3>
                <p className="text-xs text-muted-foreground">
                  You have multiple active policies of this type. Select one to proceed.
                </p>
                <div className="mt-4 grid gap-3">
                  {filteredPolicies.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPolicyId(p.id)}
                      className="flex items-center justify-between rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-foreground">
                          {p.policyNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.organizationName}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        Select →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              selectedPolicyId && (
                <div className="space-y-4">
                  {filteredPolicies.length > 1 && (
                    <button
                      onClick={() => setSelectedPolicyId(null)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      ← Choose another policy
                    </button>
                  )}
                  {selectedType === "motor" ? (
                    <MotorClaimForm policyId={selectedPolicyId} />
                  ) : (
                    <BurglaryClaimForm policyId={selectedPolicyId} />
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
