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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface SettingsFormProps {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    role: string;
  };
}

export function SettingsForm({ user }: SettingsFormProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function updateProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await authClient.updateUser({
        name: name.trim(),
        image: user.image ?? undefined,
      });

      if (result.error) {
        toast.error(result.error.message || "Could not update profile");
        return;
      }
      toast.success("Profile updated");
    });
  }

  function requestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (nextEmail === user.email.toLowerCase()) {
      toast.info("That is already your current email address");
      return;
    }

    startTransition(async () => {
      const result = await authClient.changeEmail({
        newEmail: nextEmail,
        callbackURL: "/verify-email",
      });

      if (result.error) {
        toast.error(result.error.message || "Could not start email change");
        return;
      }
      toast.success("Verification email sent");
    });
  }

  function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        toast.error(result.error.message || "Could not change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials || <UserRound className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">Profile</CardTitle>
              <CardDescription>
                Your account identity and application role.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={updateProfile} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">
                {user.role.replace("_", " ")}
              </Badge>
              {user.emailVerified ? (
                <Badge variant="outline" className="gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Email verified
                </Badge>
              ) : (
                <Badge variant="outline">Email not verified</Badge>
              )}
            </div>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Email</CardTitle>
              <CardDescription>
                Changing your email sends a verification link before it takes effect.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={requestEmailChange} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!email.trim() || isPending}>
              Send Verification
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Password</CardTitle>
              <CardDescription>
                Update your password and revoke other active sessions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <Button
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword || isPending}
            >
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
