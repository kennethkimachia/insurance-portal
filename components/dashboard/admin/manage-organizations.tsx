"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface Organization {
  id: string;
  name: string;
  code: string;
  agentCount: number;
  claimCount: number;
  createdAt: string;
}

interface ManageOrganizationsProps {
  organizations: Organization[];
}

export function ManageOrganizations({
  organizations: initial,
}: ManageOrganizationsProps) {
  const [orgs, setOrgs] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      agentCount: 0,
      claimCount: 0,
      createdAt: new Date().toISOString(),
    };
    setOrgs((prev) => [newOrg, ...prev]);
    setName("");
    setCode("");
    setShowForm(false);
  }

  function handleCopyCode(orgId: string, orgCode: string) {
    navigator.clipboard?.writeText(orgCode);
    setCopiedId(orgId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Organizations</CardTitle>
              <CardDescription>
                {orgs.length} organization{orgs.length !== 1 ? "s" : ""}{" "}
                registered
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-4 space-y-3 rounded-lg border border-dashed p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. ABC Insurance"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Short Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm font-mono text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. ABC"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || !code.trim()}
              >
                Create Organization
              </Button>
            </div>
          </form>
        )}

        {/* Organization list */}
        <div className="space-y-2">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {org.name}
                  </span>
                  <button
                    onClick={() => handleCopyCode(org.id, org.code)}
                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/80"
                  >
                    {copiedId === org.id ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {org.code}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created{" "}
                  {new Date(org.createdAt).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1 text-xs">
                  {org.agentCount} agent{org.agentCount !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs">
                  {org.claimCount} claim{org.claimCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
