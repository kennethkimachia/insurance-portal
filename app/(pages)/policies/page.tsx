import Link from "next/link";
import { Car, Home, FilePlus2 } from "lucide-react";
import { getVisiblePolicies } from "@/app/actions/policies";
import { requireSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PolicyProfileEditor } from "@/components/claims/policy-profile-editor";

export default async function PoliciesPage() {
  const [session, profiles] = await Promise.all([
    requireSession(),
    getVisiblePolicies(),
  ]);
  const canEdit = session.role === "admin" || session.role === "head_agent";
  return (
    <div className="portal-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="portal-heading">
            Insurance policies
          </h1>
          <p className="portal-intro">
            The portal supports Motor and Burglary reports. Policy details are
            recorded by staff; your insurer must confirm coverage.
          </p>
        </div>
        <Button asChild>
          <Link href="/claim-forms">
            <FilePlus2 />
            Report an incident
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Motor",
            Icon: Car,
            text: "Report an accident, theft or other vehicle damage. Driver and third-party details appear when relevant.",
          },
          {
            title: "Burglary",
            Icon: Home,
            text: "Report a premises incident, the discovery time and available information about lost or damaged property.",
          },
        ].map((product) => (
          <Card key={product.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <product.Icon className="size-10 rounded-xl bg-primary/10 p-2.5 text-primary" />
                {product.title}
              </CardTitle>
              <CardDescription>{product.text}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Supporting documents and police details can follow later.
              Reporting does not establish coverage or insurer approval.
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="text-xl font-semibold">
        {session.role === "user"
          ? "Your policy profiles"
          : "Profiles in the active organization"}
      </h2>
      {profiles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No policy profiles are registered here. Accept your agent&apos;s
            invitation or contact them for help.
          </CardContent>
        </Card>
      ) : (
        profiles.map((policy) => (
          <Card key={policy.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {policy.policyType === "motor" ? "Motor" : "Burglary"}
                </Badge>
                <Badge variant="outline">
                  {policy.source === "demo"
                    ? "Demo profile"
                    : "Manually recorded profile"}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {policy.status}
                </Badge>
              </div>
              <CardTitle className="break-all">{policy.policyNumber}</CardTitle>
              <CardDescription>
                {policy.policyholderName} ? {policy.organizationName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-5 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Insured vehicle or premises
                  </dt>
                  <dd>{policy.insuredAsset || "Not yet recorded"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Insurer reference
                  </dt>
                  <dd className="break-all">
                    {policy.insurerReference || "Not yet recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Recorded coverage dates
                  </dt>
                  <dd>
                    {policy.coverageStart || "Unknown"} to{" "}
                    {policy.coverageEnd || "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Coverage summary
                  </dt>
                  <dd className="whitespace-pre-wrap">
                    {policy.coverageSummary ||
                      "Ask your agent to record the applicable coverage."}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                The portal reference and recorded status are not proof of an
                insurer-issued policy. You may report an incident while staff
                check coverage.
              </p>
              <Button asChild variant="outline">
                <Link
                  href={`/claim-forms/${policy.policyType}?policy=${policy.id}`}
                >
                  Report an incident
                  {session.role !== "user" ? " for this policyholder" : ""}
                </Link>
              </Button>
              {canEdit && (
                <PolicyProfileEditor
                  key={`${policy.id}:${policy.version}`}
                  policy={policy}
                />
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
