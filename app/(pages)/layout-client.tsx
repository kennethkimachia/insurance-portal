"use client";

import { NavigationShell } from "@/components/navigation/navigation-shell";
import { OrgProvider } from "@/lib/org-context";

type UserRole = "admin" | "head_agent" | "agent" | "user";

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  organizations: { id: string; name: string; code: string }[];
}

export function DashboardLayoutClient({
  children,
  user,
  organizations,
}: DashboardLayoutClientProps) {
  const initialOrgId = organizations[0]?.id ?? "";

  return (
    <OrgProvider organizations={organizations} initialOrgId={initialOrgId}>
      <DashboardLayoutContent user={user}>
        {children}
      </DashboardLayoutContent>
    </OrgProvider>
  );
}

import { useOrg } from "@/lib/org-context";

function DashboardLayoutContent({
  children,
  user,
}: {
  children: React.ReactNode;
  user: DashboardLayoutClientProps["user"];
}) {
  const { currentOrg, organizations, setCurrentOrgId } = useOrg();

  return (
    <NavigationShell
      user={user}
      currentOrganization={currentOrg ?? undefined}
      organizations={organizations}
      onOrganizationChange={setCurrentOrgId}
    >
      {children}
    </NavigationShell>
  );
}
