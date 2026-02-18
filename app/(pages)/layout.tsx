"use client";

import { NavigationShell } from "@/components/navigation/navigation-shell";
import { useState } from "react";

// ── Mock user/org data (replace with real auth when backend is wired) ───

const MOCK_USER = {
  name: "James Kariuki",
  email: "james@abcinsurance.co.ke",
  role: "agent" as const,
};

const MOCK_ORGS = [
  { id: "org-1", name: "ABC Insurance", code: "ABC" },
  { id: "org-2", name: "SafeGuard Underwriters", code: "SGU" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentOrgId, setCurrentOrgId] = useState(MOCK_ORGS[0].id);
  const currentOrg =
    MOCK_ORGS.find((o) => o.id === currentOrgId) ?? MOCK_ORGS[0];

  return (
    <NavigationShell
      user={MOCK_USER}
      currentOrganization={currentOrg}
      organizations={MOCK_ORGS}
      onOrganizationChange={setCurrentOrgId}
    >
      {children}
    </NavigationShell>
  );
}
