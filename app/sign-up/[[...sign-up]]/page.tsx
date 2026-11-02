import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { invitationPreview } from "@/lib/invitations";
import { invitationRegistrationPath, isInvitationToken } from "@/lib/invitation-policy";
import { getPortalDatabaseAvailability } from "@/lib/portal-actor-store";
import { PortalUnavailable } from "@/components/auth/portal-unavailable";

export const metadata = { title: "Activate invited account", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function SignUpPage({ params }: {
  params: Promise<{ "sign-up"?: string[] }>;
}) {
  const segments = (await params)["sign-up"] ?? [];
  const token = segments[0] === "activate" && isInvitationToken(segments[1] ?? "") ? segments[1] : null;
  if (token) {
    const availability = await getPortalDatabaseAvailability();
    if (availability !== "ready") return <PortalUnavailable status={availability} next={`/invitations/${token}`} retryCurrentPage />;
  }
  const invitation = token ? await invitationPreview(token) : null;
  if (!token || !invitation || invitation.state !== "pending") {
    return <AuthShell title="Access is by invitation" description="This claims portal does not offer public registration.">
      <p className="mb-5 text-sm text-muted-foreground">Policyholders need an existing insurer policy and an invitation from authorized staff. Staff accounts are invited by an administrator. Open your invitation email to activate access, or ask the sender for a new link.</p>
      <Button asChild className="w-full"><Link href="/sign-in">Sign in to an existing account</Link></Button>
      <Link className="mt-4 block text-center text-sm underline" href="/help">Help with invitations</Link>
    </AuthShell>;
  }
  const next = `/invitations/${token}`;
  if ((await auth()).userId) redirect(next);
  return (
    <AuthShell title="Activate your invited account" description={`Set up secure access for ${invitation.email}. Review and accept your invitation after authentication.`}>
      <SignUp routing="path" path={invitationRegistrationPath(token)!} signInUrl={`/sign-in?next=${encodeURIComponent(next)}`} forceRedirectUrl={next} appearance={{ elements: { rootBox: "w-full", cardBox: "w-full", card: "shadow-none border-0" } }} />
    </AuthShell>
  );
}
