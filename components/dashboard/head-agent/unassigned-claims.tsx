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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Clock, User } from "lucide-react";
import { useState } from "react";

interface UnassignedClaim {
  id: string;
  claimNumber: string;
  policyType: "motor" | "burglary";
  policyholderName: string;
  description: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  activeClaimCount: number;
}

interface UnassignedClaimsProps {
  claims: UnassignedClaim[];
  agents: Agent[];
}

export function UnassignedClaims({ claims, agents }: UnassignedClaimsProps) {
  const [items, setItems] = useState(claims);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, string>>(
    {},
  );

  function handleAssign(claimId: string) {
    const agentId = selectedAgents[claimId];
    if (!agentId) return;
    // Mock: remove the claim from the unassigned list
    setItems((prev) => prev.filter((c) => c.id !== claimId));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-lg">Unassigned Claims</CardTitle>
            <CardDescription>
              {items.length} claim{items.length !== 1 ? "s" : ""} waiting for
              assignment
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              All claims have been assigned. Nice work!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {claim.claimNumber}
                    </span>
                    <Badge
                      variant={
                        claim.policyType === "motor" ? "default" : "secondary"
                      }
                    >
                      {claim.policyType === "motor" ? "Motor" : "Burglary"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {claim.policyholderName} · {claim.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Filed{" "}
                    {new Date(claim.createdAt).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={selectedAgents[claim.id] || ""}
                    onValueChange={(val) =>
                      setSelectedAgents((prev) => ({
                        ...prev,
                        [claim.id]: val,
                      }))
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Select agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{agent.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({agent.activeClaimCount})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!selectedAgents[claim.id]}
                    onClick={() => handleAssign(claim.id)}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
