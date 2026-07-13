"use client";

import { useSyncExternalStore } from "react";

import { Header } from "@/components/navigation/header/header";
import { AppSidebar } from "@/components/navigation/sidebar/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type UserRole = "admin" | "head_agent" | "agent" | "user";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface NavigationShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: UserRole;
  };
  currentOrganization?: { id: string; name: string; code: string };
  organizations?: { id: string; name: string; code: string }[];
  onOrganizationChange?: (orgId: string) => void;
}

export function NavigationShell({
  children,
  user,
  currentOrganization,
  organizations,
  onOrganizationChange,
}: NavigationShellProps) {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <div className="min-h-svh bg-muted/30" aria-hidden="true">
        <div className="h-14 border-b bg-background" />
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar
        user={user}
        currentOrganization={currentOrganization}
        organizations={organizations}
        onOrganizationChange={onOrganizationChange}
      />
      <SidebarInset className="min-w-0">
        <Header
          user={user}
          currentOrganization={currentOrganization}
          organizations={organizations}
          onOrganizationChange={onOrganizationChange}
        />
        <main className="min-w-0 flex-1 overflow-x-clip bg-muted/30">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
