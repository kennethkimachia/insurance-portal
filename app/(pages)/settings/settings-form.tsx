"use client";

import { UserProfile } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";

export function SettingsForm({ user }: {
  user: { name: string; email: string; emailVerified: boolean; image?: string | null; role: string };
}) {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div><p className="font-medium">{user.name}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
      <Badge variant="secondary" className="capitalize">{user.role.replace("_", " ")}</Badge>
    </div>
    <UserProfile routing="hash" />

  </div>;
}
