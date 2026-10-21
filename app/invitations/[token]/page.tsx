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

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portal invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await invitationPreview(token);
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
              "Your agent-recorded contact details and policy will be saved when you accept."}
          </p>
          <AcceptInvitation token={token} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create an account and verify your email, or sign in to your existing
            account. Then return here to accept.
          </p>
          <Button asChild className="w-full">
            <Link href={`/sign-up?token=${token}`}>Create account</Link>
          </Button>
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
