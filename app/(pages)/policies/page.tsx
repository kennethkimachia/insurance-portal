import Link from "next/link";
import { Building2, Car, FileText, Home, ShieldCheck } from "lucide-react";
import { getVisiblePolicies } from "@/app/actions/policies";
import { getSessionUser } from "@/lib/session";
import { ROUTES } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const policyProducts = [
  {
    type: "motor",
    title: "Motor Insurance",
    description: "Claims for accidental damage, theft, fire, third-party injury, and property damage.",
    Icon: Car,
    documents: "Police abstract, logbook, driving licence, ID/KRA PIN, scene evidence, and repair estimate",
  },
  {
    type: "burglary",
    title: "Burglary Insurance",
    description: "Claims for forcible entry, stolen insured property, and resulting premises damage.",
    Icon: Home,
    documents: "Police abstract, proof of ownership, entry evidence, valuations, and security report where applicable",
  },
] as const;

export default async function PoliciesPage() {
  const [session, policies] = await Promise.all([getSessionUser(), getVisiblePolicies()]);
  const isPolicyholder = session?.role === "user";

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Badge variant="secondary" className="mb-3">Available cover</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Insurance policies</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Review the policy products supported by the claims portal and the evidence normally needed when filing.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        {policyProducts.map(({ type, title, description, Icon, documents }) => (
          <Card key={type} className="overflow-hidden">
            <CardHeader>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="mb-1 font-medium">Typical claim evidence</p>
                <p className="text-muted-foreground">{documents}.</p>
              </div>
              {isPolicyholder && policies.some((policy) => policy.policyType === type) && (
                <Button asChild><Link href={ROUTES.CLAIMS}>Start a {title.toLowerCase()} claim</Link></Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{isPolicyholder ? "Your policies" : "Policies in this organization"}</h2>
            <p className="text-sm text-muted-foreground">Policy numbers use MOT-ORG-##### or BRG-ORG-#####.</p>
          </div>
          {isPolicyholder && <Button asChild variant="outline"><Link href={ROUTES.CLAIMS}><FileText className="h-4 w-4" /> File a claim</Link></Button>}
        </div>
        {policies.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No policies are registered in this scope.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {policies.map((policy) => (
              <Card key={policy.id}>
                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
                    <div>
                      <p className="font-mono font-semibold">{policy.policyNumber}</p>
                      <p className="text-sm capitalize text-muted-foreground">{policy.policyType} policy ? {policy.policyholderName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" /> {policy.organizationName}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
