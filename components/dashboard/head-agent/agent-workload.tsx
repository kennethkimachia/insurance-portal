"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { User, Briefcase } from "lucide-react";

type WorkloadLevel = "available" | "moderate" | "busy" | "overloaded";

interface AgentWorkloadItem {
  id: string;
  name: string;
  email: string;
  activeClaimCount: number;
  latestClaim?: string;
}

interface AgentWorkloadProps {
  agents: AgentWorkloadItem[];
}

function getWorkloadLevel(count: number): WorkloadLevel {
  if (count <= 2) return "available";
  if (count <= 4) return "moderate";
  if (count <= 9) return "busy";
  return "overloaded";
}

const levelConfig: Record<
  WorkloadLevel,
  { label: string; bg: string; text: string; ring: string; dot: string }
> = {
  available: {
    label: "Available",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  moderate: {
    label: "Moderate",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    ring: "ring-blue-500/20",
    dot: "bg-blue-500",
  },
  busy: {
    label: "Busy",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-500/20",
    dot: "bg-amber-500",
  },
  overloaded: {
    label: "Overloaded",
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-red-500/20",
    dot: "bg-red-500",
  },
};

export function AgentWorkload({ agents }: AgentWorkloadProps) {
  const sorted = [...agents].sort(
    (a, b) => b.activeClaimCount - a.activeClaimCount,
  );

  const totals = {
    available: agents.filter(
      (a) => getWorkloadLevel(a.activeClaimCount) === "available",
    ).length,
    moderate: agents.filter(
      (a) => getWorkloadLevel(a.activeClaimCount) === "moderate",
    ).length,
    busy: agents.filter((a) => getWorkloadLevel(a.activeClaimCount) === "busy")
      .length,
    overloaded: agents.filter(
      (a) => getWorkloadLevel(a.activeClaimCount) === "overloaded",
    ).length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Agent Workload</CardTitle>
            <CardDescription>
              {agents.length} agents in your team
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(totals) as WorkloadLevel[]).map((level) => {
            const config = levelConfig[level];
            return (
              <div
                key={level}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${config.bg} ${config.text} ${config.ring}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                {config.label}: {totals[level]}
              </div>
            );
          })}
        </div>

        {/* Agent cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((agent) => {
            const level = getWorkloadLevel(agent.activeClaimCount);
            const config = levelConfig[level];

            return (
              <div
                key={agent.id}
                className={`rounded-lg border p-3 transition-all hover:shadow-sm ${config.bg}`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.email}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                    <span className={`text-xs font-medium ${config.text}`}>
                      {config.label}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {agent.activeClaimCount}
                  </span>
                </div>
                {agent.latestClaim && (
                  <p className="mt-1.5 text-xs text-muted-foreground truncate">
                    Latest: {agent.latestClaim}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
