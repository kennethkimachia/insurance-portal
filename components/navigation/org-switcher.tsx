"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface OrgSwitcherProps {
  current: Organization;
  organizations: Organization[];
  onChange: (orgId: string) => void;
}

export function OrgSwitcher({
  current,
  organizations,
  onChange,
}: OrgSwitcherProps) {
  return (
    <Select value={current.id} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto gap-1.5 border-dashed text-xs">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            <div className="flex items-center gap-2">
              <span>{org.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {org.code}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
