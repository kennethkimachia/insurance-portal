import { auth } from "@clerk/nextjs/server";
import { invitationPreview } from "@/lib/invitations";
import { getAuthenticatedClerkIdentity } from "@/lib/session";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AcceptInvitation,
  InvitationSignOut,
} from "@/components/auth/accept-invitation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { invitationRegistrationPath, isInvitationToken } from "@/lib/invitation-policy";
import { getPortalDatabaseAvailability } from "@/lib/portal-actor-store";
import { PortalUnavailable } from "@/components/auth/portal-unavailable";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portal invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ __clerk_ticket?: string }>;
}) {
  const { token } = await params;
  if (isInvitationToken(token)) {
    const availability = await getPortalDatabaseAvailability();
    if (availability !== "ready") return <PortalUnavailable status={availability} next={`/invitations/${token}`} retryCurrentPage />;
  }
  const invitation = await invitationPreview(token);
  const ticket = (await searchParams).__clerk_ticket;
  if (!invitation)
    return (
      <AuthShell
        title="Invalid invitation"
        description="This invitation link cannot be used."
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Ask your agent or administrator for a new link.
        </p>
        <Button asChild variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </AuthShell>
    );
  const identity = await getAuthenticatedClerkIdentity();
  const signedIn = !!(await auth()).userId;
  const next = `/invitations/${token}`;
  const role = {
    admin: "Platform administrator",
    head_agent: "Claims manager",
    agent: "Agent",
    user: "Policyholder",
  }[invitation.role];
  return (
    <AuthShell
      title={
        invitation.state === "pending"
          ? "Review your invitation"
          : `Invitation ${invitation.state}`
      }
      description={`${invitation.inviterName} invited you to ${invitation.organizationName}.`}
    >
      <dl className="mb-5 space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Access</dt>
          <dd className="font-medium">{role}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Invited account</dt>
          <dd className="break-all">{invitation.email}</dd>
        </div>
        {invitation.policyType && (
          <div>
            <dt className="text-muted-foreground">Policy</dt>
            <dd className="capitalize">
              {invitation.policyType} · {invitation.maskedPolicyNumber} ·{" "}
              {invitation.source === "demo"
                ? "Demonstration record"
                : "Manually recorded"}
            </dd>
          </div>
        )}
        {invitation.insurerReference && <div><dt className="text-muted-foreground">Insurer policy number</dt><dd>{invitation.insurerReference}</dd></div>}
        {invitation.insuredAsset && <div><dt className="text-muted-foreground">Insured vehicle or premises</dt><dd>{invitation.insuredAsset}</dd></div>}
        {(invitation.coverageStart || invitation.coverageEnd) && <div><dt className="text-muted-foreground">Recorded coverage dates</dt><dd>{invitation.coverageStart || "Unknown"} to {invitation.coverageEnd || "Unknown"}</dd></div>}
        {invitation.coverageSummary && <div><dt className="text-muted-foreground">Recorded coverage summary</dt><dd className="whitespace-pre-wrap">{invitation.coverageSummary}</dd></div>}
        <div>
          <dt className="text-muted-foreground">Expires</dt>
          <dd>
            {new Date(invitation.expiresAt).toLocaleString("en-KE", {
              timeZone: "Africa/Nairobi",
            })}
          </dd>
        </div>
      </dl>
      {invitation.state !== "pending" ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-muted-foreground">
            {invitation.state === "accepted"
              ? "This link has already been used. Sign in to access your portal."
              : "Ask the sender to resend an expired invitation or replace a revoked invitation."}
          </p>
          <Button asChild className="w-full">
            <Link href={identity ? "/dashboard" : "/sign-in"}>
              Go to portal
            </Link>
          </Button>
        </div>
      ) : !identity && signedIn ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm">This Clerk account is unavailable or has an invalid portal role. Ask your administrator to review it, or sign in with the invited account.</p>
          <InvitationSignOut token={token} />
        </div>
      ) : identity &&
        identity.email.toLowerCase() !== invitation.email.toLowerCase() ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm">
            You are signed in as {identity.email}. This invitation belongs to a
            different account.
          </p>
          <InvitationSignOut token={token} />
        </div>
      ) : identity && !identity.emailVerified ? (
        <Button asChild className="w-full">
          <Link
            href={`/verify-email?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(next)}`}
          >
            Verify email to continue
          </Link>
        </Button>
      ) : identity ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Accepting associates this verified account with the organization and
            access shown above.{" "}
            {invitation.purpose === "policyholder" &&
              "Check the policy details above. Contact the sender if anything is incorrect. Your agent-recorded contact details and policy will be saved when you accept. This activates portal access and does not purchase insurance or confirm coverage for a claim."}
          </p>
          <AcceptInvitation token={token} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Activate your invited account using the invitation email, or sign in to an existing account. You will then review and accept this access.
          </p>
          {ticket ? <Button asChild className="w-full">
            <Link href={`${invitationRegistrationPath(token)}?__clerk_ticket=${encodeURIComponent(ticket)}`}>Activate invited account</Link>
          </Button> : <p className="text-sm text-muted-foreground">For first-time activation, open the latest invitation email from Clerk. If it is missing or expired, ask the sender to resend it.</p>}
          <Button asChild variant="outline" className="w-full">
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>
              Sign in to accept
            </Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
