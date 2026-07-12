"use client";

import { createContext, useContext, useState, ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [currentOrgId, setCurrentOrgIdState] = useState(initialOrgId);

  const currentOrg =
    organizations.find((o) => o.id === currentOrgId) ??
    organizations[0] ??
    null;

  function setCurrentOrgId(id: string) {
    setCurrentOrgIdState(id);
    document.cookie = `active_organization_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
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
