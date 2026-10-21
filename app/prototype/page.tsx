import { notFound } from "next/navigation";
import Link from "next/link";
import { ClaimWorkspace } from "@/components/claims/claim-workspace";
import { demoWorkspace } from "@/lib/prototype-fixtures";
import type { Role } from "@/lib/permissions";
import { isPrototypePreviewEnabled } from "@/lib/prototype-mode";
export const dynamic = "force-dynamic";

export default async function PrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; policy?: string }>;
}) {
  if (!isPrototypePreviewEnabled(process.env)) notFound();
  const params = await searchParams;
  const role: Role = ["user", "agent", "head_agent", "admin"].includes(
    params.role ?? "",
  )
    ? (params.role as Role)
    : "user";
  const policy = params.policy === "burglary" ? "burglary" : "motor";
  return (
    <main className="portal-page">
      <nav
        className="portal-panel flex flex-wrap items-center gap-2 p-3 text-sm"
        aria-label="Prototype scenarios"
      >
        <span className="mr-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Synthetic preview</span>
        {[
          ["user", "Policyholder"],
          ["agent", "Agent"],
          ["head_agent", "Claims manager"],
          ["admin", "Administrator"],
        ].map(([id, label]) => (
          <Link
            key={id}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-accent ${role === id ? "border-primary bg-primary/10" : ""}`}
            href={`/prototype?role=${id}&policy=${policy}`}
          >
            {label}
          </Link>
        ))}
        <Link
          className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-accent"
          href={`/prototype?role=${role}&policy=${policy === "motor" ? "burglary" : "motor"}`}
        >
          View {policy === "motor" ? "Burglary" : "Motor"}
        </Link>
        <Link
          className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-accent"
          href="/prototype/forms?policy=motor"
        >
          Motor form
        </Link>
        <Link
          className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-accent"
          href="/prototype/forms?policy=burglary"
        >
          Burglary form
        </Link>
      </nav>
      <ClaimWorkspace
        key={`${role}:${policy}`}
        data={demoWorkspace(role, policy)}
        demo
      />
    </main>
  );
}
