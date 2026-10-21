import { getPortalActorRecord } from "@/lib/portal-actor-store";
import { PortalUnavailable } from "@/components/auth/portal-unavailable";
import { RoleUpdateControls } from "@/components/auth/role-update-controls";
import { projectClerkProfile } from "@/lib/clerk-profile-policy";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { connectClerkAccount } from "@/app/actions/clerk-account";
import { safeAuthContinuation } from "@/lib/auth-navigation";
import { getSessionUser } from "@/lib/session";

const errors: Record<string, string> = {
  account: "This Clerk account is unavailable or has an invalid portal role. Contact your administrator or sign out from the profile menu.",
  verification: "Verify your primary email in your account profile before connecting.",
  revoked: "Your portal sessions were revoked. Sign out and sign in again.",
  suspended: "This portal account is suspended. Contact your administrator.",
  invitation: "Open your agent or administrator's invitation to enroll this account in the portal.",
  linked: "This portal identity is already connected to another account. Contact your administrator.",
  pending: "Your access update is pending. Retry it below.",
  role: "Your Clerk account needs an assigned portal role. Contact your administrator.",
  connection: "Your portal account could not be connected. Contact your administrator or retry.",
};

export default async function ContinuePage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeAuthContinuation(params.next);
  if (!(await auth()).userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (await getSessionUser()) redirect(next);
  const profile = await currentUser();
  const projected = profile ? projectClerkProfile(profile) : null;
  const canContinue = projected && !projected.banned && !projected.invalidRole;
  const record = canContinue && profile ? await getPortalActorRecord(profile.id) : null;
  if (record && record.status !== "ready")
    return <PortalUnavailable status={record.status} next={next} administrator={projected?.role === "admin" && projected.emailVerified} />;
  const actor = record?.status === "ready" ? record.data?.actor : null;
  return <AuthShell title="Continue to your portal" description="Confirm portal enrollment for your signed-in Clerk account.">
    <div className="mb-5 flex items-center justify-between gap-3">
      <p className="break-all text-sm">{profile?.primaryEmailAddress?.emailAddress}</p>
    </div>
    {params.error && <p role="alert" className="mb-4 text-sm text-destructive">{errors[params.error] || errors.connection}</p>}
    {!canContinue ? <p role="alert" className="text-sm">{errors.account}</p> : actor?.pendingRoleOperationId ? <div className="space-y-3"><p className="text-sm">Your access update is pending. Complete it before continuing to the portal.</p><RoleUpdateControls id={actor.pendingRoleOperationId} /></div> : <form action={connectClerkAccount}>
      <input type="hidden" name="next" value={next} />
      <Button type="submit" className="w-full">Connect account</Button>
    </form>}
    <p className="mt-4 text-sm text-muted-foreground">Portal enrollment requires an invitation or an administrator role assigned in Clerk. Profiles and roles are managed in Clerk; your policies and claims stay connected to this account.</p>
  </AuthShell>;
}
