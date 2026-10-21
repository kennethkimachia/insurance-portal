import Link from "next/link";
import { notFound } from "next/navigation";
import { MotorClaimForm } from "@/components/claims/motor-claim-form";
import { BurglaryClaimForm } from "@/components/claims/burglary-claim-form";
import { DEMO_IDS, DEMO_POLICY_PROFILE } from "@/lib/prototype-fixtures";
import { isPrototypePreviewEnabled } from "@/lib/prototype-mode";
export const dynamic = "force-dynamic";
export default async function PrototypeForms({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string }>;
}) {
  if (!isPrototypePreviewEnabled(process.env)) notFound();
  const { policy } = await searchParams;
  const burglary = policy === "burglary";
  const context = burglary
    ? {
        ...DEMO_POLICY_PROFILE,
        policyNumber: "DEMO-BRG-001",
        insuredAsset: "Demonstration premises, Nairobi",
      }
    : DEMO_POLICY_PROFILE;
  return (
    <main className="portal-page max-w-3xl">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/prototype">
          Claim workspace preview
        </Link>
        <Link
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          href={`/prototype/forms?policy=${burglary ? "motor" : "burglary"}`}
        >
          Preview {burglary ? "Motor" : "Burglary"} form
        </Link>
      </nav>
      {burglary ? (
        <BurglaryClaimForm
          key="burglary"
          policyId={DEMO_IDS.burglaryPolicy}
          policyContext={context}
          demo
        />
      ) : (
        <MotorClaimForm
          key="motor"
          policyId={DEMO_IDS.motorPolicy}
          policyContext={context}
          demo
        />
      )}
    </main>
  );
}
