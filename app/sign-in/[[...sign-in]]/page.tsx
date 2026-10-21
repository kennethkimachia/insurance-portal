import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeAuthContinuation, invitationContinuation } from "@/lib/auth-navigation";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ next?: string; callbackUrl?: string; token?: string }>;
}) {
  const params = await searchParams;
  const next = params.token ? invitationContinuation(params.token) : safeAuthContinuation(params.next || params.callbackUrl);
  const continuation = `/auth/continue?next=${encodeURIComponent(next)}`;
  if ((await auth()).userId) redirect(continuation);
  return (
    <AuthShell title="Welcome back" description="Sign in to manage your policies and claims.">
      <SignIn routing="path" path="/sign-in" signUpUrl={`/sign-up?next=${encodeURIComponent(next)}`} forceRedirectUrl={continuation} appearance={{ elements: { rootBox: "w-full", cardBox: "w-full", card: "shadow-none border-0" } }} />
    </AuthShell>
  );
}
