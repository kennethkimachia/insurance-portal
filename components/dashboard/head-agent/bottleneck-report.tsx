"use client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface StageMetric {
  stage: string;
  label: string;
  count: number;
}
export function BottleneckReport({ metrics }: { metrics: StageMetric[] }) {
  const maximum = Math.max(1, ...metrics.map((metric) => metric.count));
  const total = metrics.reduce((sum, metric) => sum + metric.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Claims by stage</CardTitle>
        <CardDescription>
          {total} open claim{total === 1 ? "" : "s"} in the active organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.stage} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{metric.label}</span>
                <span className="font-medium tabular-nums">{metric.count}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(metric.count / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {total === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            No open claims to display.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
