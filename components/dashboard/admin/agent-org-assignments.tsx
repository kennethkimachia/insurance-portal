"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, CheckCircle2, User, Building2 } from "lucide-react";
import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Assignment {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  createdAt: string;
}

interface AgentOrgAssignmentsProps {
  agents: Agent[];
  organizations: Organization[];
  assignments: Assignment[];
}

export function AgentOrgAssignments({
  agents,
  organizations,
  assignments: initial,
}: AgentOrgAssignmentsProps) {
  const [assignments, setAssignments] = useState(initial);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleAssign() {
    if (!selectedAgent || !selectedOrg) return;

    // Check for duplicate
    const exists = assignments.some(
      (a) => a.agentId === selectedAgent && a.organizationId === selectedOrg,
    );
    if (exists) return;

    const agent = agents.find((a) => a.id === selectedAgent)!;
    const org = organizations.find((o) => o.id === selectedOrg)!;

    const newAssignment: Assignment = {
      id: `asgn-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      organizationId: org.id,
      organizationName: org.name,
      organizationCode: org.code,
      createdAt: new Date().toISOString(),
    };

    setAssignments((prev) => [newAssignment, ...prev]);
    setSuccessMsg(`${agent.name} → ${org.name}`);
    setSelectedAgent("");
    setSelectedOrg("");
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function handleRemove(assignmentId: string) {
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
            <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Agent ↔ Organization</CardTitle>
            <CardDescription>
              {assignments.length} active assignment
              {assignments.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Assignment form */}
        <div className="mb-4 rounded-lg border border-dashed p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Create New Assignment
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select organization..." />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {org.name}
                      <span className="text-xs text-muted-foreground">
                        ({org.code})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              disabled={!selectedAgent || !selectedOrg}
              onClick={handleAssign}
              className="self-start"
            >
              Assign
            </Button>
          </div>

          {successMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Assigned: {successMsg}
              </p>
            </div>
          )}
        </div>

        {/* Assignment list */}
        {assignments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No assignments yet. Link an agent to an organization above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {a.agentName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.agentEmail}
                      </p>
                    </div>
                  </div>

                  <span className="text-muted-foreground">→</span>

                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {a.organizationName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {a.organizationCode}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(a.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
