"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface OrgContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  setCurrentOrgId: (id: string) => void;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({
  children,
  organizations,
  initialOrgId,
}: {
  children: ReactNode;
  organizations: Organization[];
  initialOrgId: string;
}) {
  const [currentOrgId, setCurrentOrgIdState] = useState(initialOrgId);

  const currentOrg =
    organizations.find((o) => o.id === currentOrgId) ??
    organizations[0] ??
    null;

  function setCurrentOrgId(id: string) {
    setCurrentOrgIdState(id);
    // Set a cookie so server components can optionally read the active org if needed
    document.cookie = `active_organization_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <OrgContext.Provider value={{ currentOrg, organizations, setCurrentOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
