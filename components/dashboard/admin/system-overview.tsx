"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, FileText, ShieldAlert } from "lucide-react";

interface SystemStats {
  totalOrganizations: number;
  totalAgents: number;
  totalClaims: number;
  pendingInvitations: number;
}

interface SystemOverviewProps {
  stats: SystemStats;
}

const cards = [
  {
    key: "totalOrganizations" as const,
    label: "Organizations",
    icon: Building2,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "totalAgents" as const,
    label: "Agents & Staff",
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "totalClaims" as const,
    label: "Total Claims",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    key: "pendingInvitations" as const,
    label: "Pending Invites",
    icon: ShieldAlert,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
];

export function SystemOverview({ stats }: SystemOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className="relative overflow-hidden">
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}
                >
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {stats[card.key]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
