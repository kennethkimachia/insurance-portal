"use client";

import { SignOutButton } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function LogoutPage() {
  return <AuthShell title="Sign out" description="Sign out of your current account on this device.">
    <SignOutButton redirectUrl="/sign-in"><Button className="w-full">Sign out</Button></SignOutButton>
  </AuthShell>;
}
