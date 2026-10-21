import Link from "next/link";
import { MyQueue } from "@/components/dashboard/agent/my-queue";
import { UnassignedClaims } from "@/components/dashboard/head-agent/unassigned-claims";
import { DeleteDraftButton } from "@/components/claims/delete-draft-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyAssignedClaims } from "@/app/actions/agent/manage-claims";
import {
  getAgentWorkloads,
  getUnassignedClaims,
  getManagedClaims,
} from "@/app/actions/head-agent/manage-claims";
import { getMyClaims, getMyDrafts } from "@/app/actions/user/my-claims";
import { getActiveOrganizationId } from "@/lib/organization-access";
import { requireSession } from "@/lib/session";

export default async function ClaimsPage() {
  const session = await requireSession();
  const manager = session.role === "admin" || session.role === "head_agent";
  const organizationId = await getActiveOrganizationId(session);
  const [queue, drafts, unassigned, agents] = await Promise.all([
    session.role === "user"
      ? getMyClaims()
      : session.role === "agent"
        ? getMyAssignedClaims()
        : organizationId
          ? getManagedClaims(organizationId)
          : Promise.resolve([]),
    getMyDrafts(),
    manager && organizationId
      ? getUnassignedClaims(organizationId)
      : Promise.resolve([]),
    manager && organizationId
      ? getAgentWorkloads(organizationId)
      : Promise.resolve([]),
  ]);
  return (
    <div className="portal-page">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="portal-heading">Claims</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "user"
              ? "Your submitted reports and saved drafts."
              : manager
                ? "Assign work and review submitted reports in the active organization."
                : "Your assigned claims in the active organization."}
          </p>
        </div>
        <Button asChild>
          <Link href="/claim-forms">Report an incident</Link>
        </Button>
      </div>
      {!organizationId && session.role !== "user" && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No organization is active. Contact an administrator to arrange
          membership.
        </p>
      )}
      {manager && organizationId && (
        <UnassignedClaims
          key={`${organizationId}:${unassigned.map((c) => c.id).join()}`}
          claims={unassigned.map((c) => ({
            ...c,
            description: c.description ?? "",
          }))}
          agents={agents}
        />
      )}
      {drafts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your unsubmitted drafts</h2>
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-sm">
                  {draft.policyNumber} ?{" "}
                  <span className="capitalize">{draft.policyType}</span>
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/claim-forms/${draft.policyType}?draft=${draft.id}`}
                    >
                      Resume
                    </Link>
                  </Button>
                  <DeleteDraftButton claimId={draft.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
      <MyQueue
        title={
          session.role === "user"
            ? "Your submitted claims"
            : manager
              ? "Organization claim queue"
              : "My claim queue"
        }
        description="Search and open a claim to see its evidence, requests and history."
        claims={queue
          .filter((claim) => claim.status !== "draft")
          .map((claim) => ({
            ...claim,
            description: claim.description ?? "",
            policyholderName:
              "policyholderName" in claim
                ? claim.policyholderName
                : session.name,
          }))}
      />
    </div>
  );
}
