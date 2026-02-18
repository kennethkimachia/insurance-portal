"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle } from "lucide-react";

interface StageMetric {
  stage: string;
  label: string;
  avgDays: number;
}

interface BottleneckReportProps {
  metrics: StageMetric[];
}

export function BottleneckReport({ metrics }: BottleneckReportProps) {
  const maxDays = Math.max(...metrics.map((m) => m.avgDays));
  const bottleneck = metrics.reduce((worst, m) =>
    m.avgDays > worst.avgDays ? m : worst,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Bottleneck Report</CardTitle>
            <CardDescription>
              Average time per claim stage across all agents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Worst stage callout */}
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">
              &quot;{bottleneck.label}&quot;
            </span>{" "}
            is the slowest stage, averaging{" "}
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {bottleneck.avgDays} days
            </span>
          </p>
        </div>

        {/* Horizontal bar chart */}
        <div className="space-y-3">
          {metrics.map((metric) => {
            const widthPct = Math.max((metric.avgDays / maxDays) * 100, 4);
            const isBottleneck = metric.stage === bottleneck.stage;

            return (
              <div key={metric.stage} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {metric.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {metric.avgDays}d
                    </span>
                    {isBottleneck && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0"
                      >
                        Slowest
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ease-out ${
                      isBottleneck ? "bg-amber-500" : "bg-primary/70"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Total Avg</p>
            <p className="text-lg font-bold text-foreground">
              {metrics.reduce((sum, m) => sum + m.avgDays, 0)}d
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Fastest</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {Math.min(...metrics.map((m) => m.avgDays))}d
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5 text-center">
            <p className="text-xs text-muted-foreground">Slowest</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {maxDays}d
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
