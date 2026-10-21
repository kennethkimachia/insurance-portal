"use client";
import { useState } from "react";
import { acceptPortalInvitation } from "@/app/actions/invitations";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setPending(true);
    setError("");
    try {
      const result = await acceptPortalInvitation(token);
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Your invitation could not be accepted. Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending} onClick={accept}>
        {pending ? "Accepting invitation…" : error ? "Retry invitation" : "Accept invitation"}
      </Button>
    </div>
  );
}

export function InvitationSignOut({ token }: { token: string }) {
  const { signOut } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await signOut({ redirectUrl: `/sign-in?next=${encodeURIComponent(`/invitations/${token}`)}` });
          } catch {
            setError("Could not sign out. Please retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign in with the invited account"}
      </Button>
    </div>
  );
}
