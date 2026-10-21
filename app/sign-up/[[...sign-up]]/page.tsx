import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeAuthContinuation, invitationContinuation } from "@/lib/auth-navigation";

export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<{ next?: string; token?: string }>;
}) {
  const params = await searchParams;
  const next = params.token ? invitationContinuation(params.token) : safeAuthContinuation(params.next);
  const continuation = `/auth/continue?next=${encodeURIComponent(next)}`;
  if ((await auth()).userId) redirect(continuation);
  return (
    <AuthShell title="Create your account" description="Create your secure account. An invitation connects it to portal access.">
      <SignUp routing="path" path="/sign-up" signInUrl={`/sign-in?next=${encodeURIComponent(next)}`} forceRedirectUrl={continuation} appearance={{ elements: { rootBox: "w-full", cardBox: "w-full", card: "shadow-none border-0" } }} />
    </AuthShell>
  );
}
