"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, ArrowRight } from "lucide-react";
import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  activeClaimCount: number;
}

interface ReassignAgentDialogProps {
  claimNumber: string;
  currentAgentName: string;
  agents: Agent[];
  onReassign?: (newAgentId: string) => void;
  onClose?: () => void;
}

export function ReassignAgentDialog({
  claimNumber,
  currentAgentName,
  agents,
  onReassign,
  onClose,
}: ReassignAgentDialogProps) {
  const [selected, setSelected] = useState("");
  const [reassigned, setReassigned] = useState(false);

  function handleReassign() {
    if (!selected) return;
    setReassigned(true);
    onReassign?.(selected);
  }

  const selectedAgent = agents.find((a) => a.id === selected);

  if (reassigned) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <ArrowRight className="h-5 w-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Claim Reassigned
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono font-medium">{claimNumber}</span> has been
          reassigned to{" "}
          <span className="font-semibold">{selectedAgent?.name}</span>
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-lg">
      <h3 className="text-lg font-semibold text-foreground">Reassign Claim</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Move{" "}
        <span className="font-mono font-medium text-foreground">
          {claimNumber}
        </span>{" "}
        to a different agent.
      </p>

      {/* Current agent */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Currently assigned to</p>
          <p className="text-sm font-medium text-foreground">
            {currentAgentName}
          </p>
        </div>
      </div>

      {/* New agent selector */}
      <div className="mt-4 space-y-2">
        <label className="text-sm font-medium text-foreground">New Agent</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select new agent..." />
          </SelectTrigger>
          <SelectContent>
            {agents
              .filter((a) => a.name !== currentAgentName)
              .map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{agent.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({agent.activeClaimCount} claims)
                    </span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!selected} onClick={handleReassign}>
          Change Agent
        </Button>
      </div>
    </div>
  );
}
