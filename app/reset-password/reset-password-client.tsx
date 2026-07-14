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
import { Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function requestReset(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: "/reset-password",
      });

      if (result.error) {
        toast.error(result.error.message || "Could not send reset email");
        return;
      }
      setSent(true);
      toast.success("Password reset email sent");
    });
  }

  function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await authClient.resetPassword({
        token,
        newPassword,
      });

      if (result.error) {
        toast.error(result.error.message || "Could not reset password");
        return;
      }
      setComplete(true);
      toast.success("Password reset complete");
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
          <CardTitle className="text-2xl font-semibold">
            {token ? "Set a new password" : "Reset password"}
          </CardTitle>
          <CardDescription>
            {token
              ? "Choose a new password for your account."
              : "Enter your email and we will send a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {complete ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Your password has been updated.</p>
              <Button asChild className="w-full">
                <Link href={ROUTES.SIGNIN}>Sign in</Link>
              </Button>
            </div>
          ) : token ? (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </form>
          ) : sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>If an account exists for {email}, a reset link has been sent.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href={ROUTES.SIGNIN}>Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={!email.trim() || isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
