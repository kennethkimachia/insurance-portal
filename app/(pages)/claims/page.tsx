import { MyQueue } from "@/components/dashboard/agent/my-queue";
import { UnassignedClaims } from "@/components/dashboard/head-agent/unassigned-claims";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { claims, policies, user } from "@/db/schema";
import { getMyAssignedClaims } from "@/app/actions/agent/manage-claims";
import { getAgentWorkloads, getUnassignedClaims } from "@/app/actions/head-agent/manage-claims";
import { getActiveOrganizationId, requireOrganizationAccess } from "@/lib/organization-access";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/lib/session";
import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { CalendarDays, FileText, Mail, UserRound } from "lucide-react";

type ClaimStatus =
  | "pending"
  | "assigned"
  | "surveyor_dispatched"
  | "under_review"
  | "assessment_complete"
  | "approved"
  | "settled"
  | "rejected";

const statusLabels: Record<ClaimStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  surveyor_dispatched: "Surveyor Dispatched",
  under_review: "Under Review",
  assessment_complete: "Assessment Complete",
  approved: "Approved",
  settled: "Settled",
  rejected: "Rejected",
};

export default async function ClaimsPage() {
  const session = await getSessionUser();
  if (!session) redirect(ROUTES.SIGNIN);

  if (session.role === "agent") {
    const assignedClaims = await getMyAssignedClaims();
    return (
      <PageShell
        title="Claims"
        description="Claims assigned to you in the active organization."
      >
        <MyQueue
          claims={assignedClaims.map((claim) => ({
            id: claim.id,
            claimNumber: claim.claimNumber,
            policyholderName: claim.policyholderName,
            policyType: claim.policyType as "motor" | "burglary",
            status: claim.status as ClaimStatus,
            description: claim.description || "",
            createdAt: claim.createdAt,
          }))}
        />
      </PageShell>
    );
  }

  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) {
    return (
      <PageShell title="Claims" description="Review and route organization claims.">
        <EmptyPanel message="No organization is active." />
      </PageShell>
    );
  }

  await requireOrganizationAccess(session, organizationId);

  const canSeeAll = session.role === "admin" || session.role === "head_agent";
  const whereClause = canSeeAll
    ? eq(claims.organizationId, organizationId)
    : and(eq(claims.organizationId, organizationId), eq(policies.userId, session.id));

  const allClaims = await db
    .select({
      id: claims.id,
      claimNumber: claims.claimNumber,
      status: claims.status,
      description: claims.description,
      createdAt: claims.createdAt,
      policyType: policies.policyType,
      policyNumber: policies.policyNumber,
      policyholderName: user.name,
      policyholderEmail: user.email,
      assignedAgentName: sql<string | null>`(
        SELECT assigned.name FROM "user" assigned
        WHERE assigned.id = ${claims.assignedAgentId}
      )`,
    })
    .from(claims)
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .innerJoin(user, eq(user.id, policies.userId))
    .where(whereClause)
    .orderBy(desc(claims.createdAt));

  const [unassignedClaims, agents] = canSeeAll
    ? await Promise.all([
        getUnassignedClaims(organizationId),
        getAgentWorkloads(organizationId),
      ])
    : [[], []];

  return (
    <PageShell
      title="Claims"
      description={
        canSeeAll
          ? "Review new claims, assign work, and monitor every claim in the active organization."
          : "Track the claims you have submitted."
      }
    >
      {canSeeAll && (
        <UnassignedClaims
          claims={unassignedClaims.map((claim) => ({
            id: claim.id,
            claimNumber: claim.claimNumber,
            policyType: claim.policyType as "motor" | "burglary",
            policyholderName: claim.policyholderName,
            description: claim.description || "",
            createdAt: claim.createdAt,
          }))}
          agents={agents}
        />
      )}

      <div className={canSeeAll ? "mt-6" : ""}>
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="hidden grid-cols-[1fr_1.1fr_0.8fr_0.8fr_0.8fr] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Claim</span>
            <span>Policyholder</span>
            <span>Status</span>
            <span>Assigned</span>
            <span>Filed</span>
          </div>
          <div className="divide-y">
            {allClaims.length === 0 ? (
              <EmptyPanel message="No claims found for this organization." />
            ) : (
              allClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1.1fr_0.8fr_0.8fr_0.8fr] lg:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {claim.claimNumber}
                      </span>
                      <Badge variant={claim.policyType === "motor" ? "default" : "secondary"}>
                        {claim.policyType === "motor" ? "Motor" : "Burglary"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {claim.policyNumber} · {claim.description || "No description"}
                    </p>
                  </div>

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {claim.policyholderName}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{claim.policyholderEmail}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <Badge variant={claim.status === "pending" ? "outline" : "secondary"}>
                      {statusLabels[claim.status as ClaimStatus]}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    {claim.assignedAgentName || "Unassigned"}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {claim.createdAt.toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
