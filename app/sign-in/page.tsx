"use client";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,

} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import Link from "next/link";



export default function SignIn() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-muted/30 px-4 py-16 sm:px-6 md:py-10">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,var(--color-primary),transparent_65%)] opacity-10" />
      <Link href="/" className="fixed left-4 top-4 z-50 flex items-center gap-2 font-semibold sm:left-6 sm:top-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Shield className="size-5" /></span>
        <span className="hidden sm:inline">InsurePortal</span>
      </Link>
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ModeToggle />
      </div>
      <div className="relative w-full max-w-md">
        <Card className="border bg-card shadow-xl shadow-foreground/5">
          <CardHeader className="border-b pb-5">
            <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Sign in to manage your policies, claims, and documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  value={email}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="#"
                    className="ml-auto text-xs font-medium text-primary hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>

                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  onClick={() => {
                    setRememberMe(!rememberMe);
                  }}
                />
                <Label htmlFor="remember">Remember me</Label>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                onClick={async () => {
                  await signIn.email({
                    email,
                    password,
                    rememberMe,
                    fetchOptions: {
                      onRequest: () => {
                        setLoading(true);
                      },
                      onResponse: () => {
                        setLoading(false);
                      },
                      onSuccess: () => {
                        window.location.href = "/dashboard";
                      },
                    },
                  });
                }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Sign in"
                )}
              </Button>
              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/sign-up" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
