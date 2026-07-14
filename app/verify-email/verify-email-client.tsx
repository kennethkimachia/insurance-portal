"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { ROUTES } from "@/lib/routes";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle",
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    startTransition(async () => {
      const result = await authClient.verifyEmail({
        query: { token, callbackURL: "/dashboard" },
      });

      if (result.error) {
        setStatus("error");
        setMessage(result.error.message || "The verification link is invalid or expired.");
        return;
      }
      setStatus("success");
      setMessage("Your email has been verified.");
    });
  }, [token]);

  function sendVerification(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await authClient.sendVerificationEmail({
        email: email.trim().toLowerCase(),
        callbackURL: "/verify-email",
      });

      if (result.error) {
        toast.error(result.error.message || "Could not send verification email");
        return;
      }
      toast.success("Verification email sent");
      setMessage("Check your inbox for the verification link.");
    });
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-muted/30 px-4 py-16 sm:px-6 md:py-10">
      <Link href={ROUTES.HOME} className="fixed left-4 top-4 z-50 flex items-center gap-2 font-semibold sm:left-6 sm:top-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Shield className="size-5" />
        </span>
        <span className="hidden sm:inline">InsurePortal</span>
      </Link>
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md border bg-card shadow-xl shadow-foreground/5">
        <CardHeader className="border-b pb-5">
          <CardTitle className="text-2xl font-semibold">Verify email</CardTitle>
          <CardDescription>
            Confirm your email address or request a new verification link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                {status === "success" ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : status === "error" ? (
                  <XCircle className="h-6 w-6 text-destructive" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {message || "Verifying your email address..."}
              </p>
              <Button asChild className="w-full">
                <Link href={status === "success" ? ROUTES.DASHBOARD : ROUTES.SIGNIN}>
                  {status === "success" ? "Go to dashboard" : "Back to sign in"}
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={sendVerification} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button type="submit" className="w-full" disabled={!email.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Verification Email"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
