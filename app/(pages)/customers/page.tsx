import { hydrateActors } from "@/lib/clerk-directory";
import { db } from "@/db";
import { policies, portalActors, policyholderEnrollments } from "@/db/schema";
import {
  getActiveOrganizationId,
  requireOrganizationAccess,
} from "@/lib/organization-access";
import { ROUTES } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Mail, ShieldCheck, UserRound } from "lucide-react";

export default async function CustomersPage() {
  const session = await requireSession();
  if (session.role === "user") {
    redirect(ROUTES.DASHBOARD);
  }

  const organizationId = await getActiveOrganizationId(session);
  if (!organizationId) {
    return (
      <PageShell>
        <EmptyPanel message="Select or join an organization to view policyholders." />
      </PageShell>
    );
  }

  await requireOrganizationAccess(session, organizationId);

  const customerRows = await db
    .select({
      id: portalActors.id,
      phone: policyholderEnrollments.phone,
      createdAt: portalActors.createdAt,
      policyCount: sql<number>`COUNT(${policies.id})::int`,
      policyTypes: sql<string>`STRING_AGG(DISTINCT ${policies.policyType}::text, ', ')`,
      claimCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM claims
        INNER JOIN policies p ON p.id = claims.policy_id
        WHERE p.user_id = ${portalActors.id}
          AND claims.organization_id = ${organizationId}
          AND claims.status <> 'draft'
      )`,
    })
    .from(portalActors)
    .innerJoin(policies, eq(policies.userId, portalActors.id))
    .leftJoin(policyholderEnrollments, eq(policyholderEnrollments.actorId, portalActors.id))
    .where(eq(policies.organizationId, organizationId))
    .groupBy(portalActors.id, policyholderEnrollments.phone)
    .orderBy(desc(portalActors.createdAt));

  const customers = await hydrateActors(customerRows);
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page">
        <div className="mb-8">
          <h1 className="portal-heading">
            Customers
          </h1>
          <p className="portal-intro">
            Policyholder profiles for the active organization.
          </p>
        </div>

        {customers.length === 0 ? (
          <EmptyPanel message="This organization does not have customer policies yet." />
        ) : (
          <div className="portal-panel overflow-hidden">
            <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 portal-table-head md:grid">
              <span>Customer</span>
              <span>Policies</span>
              <span>Claims</span>
              <span>Joined</span>
            </div>
            <div className="divide-y">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="portal-row grid gap-4 px-5 py-5 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserRound className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {customer.name}
                      </p>
                      <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </p>
                      {customer.phone && (
                        <p className="text-xs text-muted-foreground">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {customer.policyCount} polic
                      {customer.policyCount === 1 ? "y" : "ies"}
                    </Badge>
                    {customer.policyTypes
                      ?.split(", ")
                      .filter(Boolean)
                      .map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className="capitalize"
                        >
                          {type}
                        </Badge>
                      ))}
                  </div>

                  <div>
                    <Badge
                      variant={customer.claimCount > 0 ? "default" : "outline"}
                    >
                      {customer.claimCount} claim
                      {customer.claimCount === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {customer.emailVerified && (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    )}
                    {customer.createdAt.toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page">
        <h1 className="portal-heading">
          Customers
        </h1>
        <p className="portal-intro">
          Policyholder profiles for the active organization.
        </p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="portal-empty">
      {message}
    </div>
  );
}
