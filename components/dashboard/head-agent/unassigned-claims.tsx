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
import { AlertTriangle, Clock, User, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { assignClaimToAgent } from "@/app/actions/head-agent/manage-claims";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [isPending, startTransition] = useTransition();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAssign(claimId: string) {
    const agentId = selectedAgents[claimId];
    if (!agentId) return;
    setAssigningId(claimId);
    startTransition(async () => {
      try {
        const result = await assignClaimToAgent(claimId, agentId);
        if (result.success) {
          setItems((prev) => prev.filter((c) => c.id !== claimId));
          setError(null);
          router.refresh();
        } else setError(result.error ?? "Unable to assign this claim");
      } catch {
        setError("Unable to save this assignment. Please try again.");
      } finally {
        setAssigningId(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="portal-icon">
            <AlertTriangle className="h-4 w-4 text-primary" />
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
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {items.length === 0 ? (
          <div className="portal-empty">
            <p className="text-sm text-muted-foreground">
              No claims are waiting for assignment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-col gap-3 rounded-lg border bg-background/70 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/claims/${claim.id}`}
                      className="font-mono text-sm font-semibold text-foreground hover:underline"
                    >
                      {claim.claimNumber}
                    </Link>
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
                    disabled={
                      !selectedAgents[claim.id] ||
                      (isPending && assigningId === claim.id)
                    }
                    onClick={() => handleAssign(claim.id)}
                  >
                    {isPending && assigningId === claim.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Assign"
                    )}
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
