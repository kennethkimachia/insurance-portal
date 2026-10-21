"use client";

import Link from "next/link";
import { MyQueue } from "@/components/dashboard/agent/my-queue";
import { OnboardPolicyholder } from "@/components/dashboard/agent/onboard-policyholder";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useOrg } from "@/lib/org-context";
import type { getMyAssignedClaims } from "@/app/actions/agent/manage-claims";

export function AgentDashboardClient({
  claims,
  agentName,
}: {
  claims: Awaited<ReturnType<typeof getMyAssignedClaims>>;
  agentName: string;
}) {
  const { currentOrg } = useOrg();
  const scoped = claims.filter(
    (claim) => !currentOrg || claim.organizationId === currentOrg.id,
  );
  return (
    <div className="portal-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="portal-heading">
            Agent dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Welcome, {agentName}. Review your assigned claims and invite
            policyholders in {currentOrg?.name || "your organization"}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/notifications">Claim updates</Link>
        </Button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <MyQueue
          claims={scoped.map((claim) => ({
            ...claim,
            description: claim.description ?? "",
          }))}
        />
        <OnboardPolicyholder
          organizationId={currentOrg?.id}
          organizationName={currentOrg?.name}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Working on a claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Open a claim to inspect its original report, review documents,
            request information, record an assessment, and send messages.
            Internal notes stay visible to authorized staff.
          </p>
          <p>
            Managers assign work and record outcomes. Supporting tasks remain
            separate from the system milestones.
          </p>
          {!scoped.length && (
            <p>
              No claims have been assigned here yet. Policyholder invitations
              remain available above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
