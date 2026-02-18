"use client";

import { Header } from "@/components/navigation/header/header";
import { AppSidebar } from "@/components/navigation/sidebar/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

type UserRole = "admin" | "head_agent" | "agent" | "user";

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
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar
        user={user}
        currentOrganization={currentOrganization}
        organizations={organizations}
        onOrganizationChange={onOrganizationChange}
      />
      <SidebarInset>
        <Header
          user={user}
          currentOrganization={currentOrganization}
          organizations={organizations}
          onOrganizationChange={onOrganizationChange}
        />
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
