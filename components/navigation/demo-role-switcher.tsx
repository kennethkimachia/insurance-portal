"use client";

import { useState, useTransition } from "react";
import { switchDemoRole } from "@/app/actions/demo-role";
import { DEMO_ROLES } from "@/lib/demo-role-policy";
import type { Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function DemoRoleSwitcher({ role, accountRole, active }: {
  role: Role;
  accountRole: Role;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const accountLabel = DEMO_ROLES.find((item) => item.role === accountRole)?.label;

  function changeRole(value: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await switchDemoRole(value);
        if (!result.success) {
          setError(result.error);
          return;
        }
        // Reload the dashboard and navigation together, clearing the previous role's cache.
        window.location.assign("/dashboard");
      } catch {
        setError("Could not switch roles. Please retry.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <section aria-label="Demo role switcher" aria-busy={pending}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <Label htmlFor="demo-role">Demo role</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch roles to showcase the platform with this account.
          </p>
        </div>
        <select id="demo-role" value={active ? role : "account"} disabled={pending}
          onChange={(event) => changeRole(event.target.value)}
          className="h-9 max-w-full rounded-lg border bg-background px-3 text-sm">
          <option value="account">My account ({accountLabel})</option>
          {DEMO_ROLES.map((item) => (
            <option key={item.role} value={item.role}>{item.label}</option>
          ))}
        </select>
        {active && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => changeRole("account")}>
            Exit demo
          </Button>
        )}
        {pending && <p role="status" className="text-xs text-muted-foreground">Switching role…</p>}
        {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
      </section>
    </div>
  );
}
