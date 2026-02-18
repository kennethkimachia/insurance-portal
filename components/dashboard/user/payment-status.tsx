"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, Clock, CheckCircle2 } from "lucide-react";

type PaymentState = "pending" | "processing" | "paid";

interface PaymentStatusProps {
  payment: {
    status: PaymentState;
    expectedAmount: number;
    currency: string;
    referenceNumber: string | null;
  };
}

const statusConfig: Record<
  PaymentState,
  {
    label: string;
    variant: "secondary" | "default" | "outline";
    icon: typeof Clock;
  }
> = {
  pending: { label: "Awaiting Approval", variant: "secondary", icon: Clock },
  processing: { label: "Processing", variant: "outline", icon: Banknote },
  paid: { label: "Paid", variant: "default", icon: CheckCircle2 },
};

export function PaymentStatus({ payment }: PaymentStatusProps) {
  const config = statusConfig[payment.status];
  const StatusIcon = config.icon;

  const formattedAmount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: payment.currency,
    minimumFractionDigits: 0,
  }).format(payment.expectedAmount);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Settlement</CardTitle>
          <Badge variant={config.variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Expected Amount</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formattedAmount}
            </p>
          </div>

          {payment.referenceNumber && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Payment Reference</p>
              <p className="font-mono text-sm font-medium text-foreground">
                {payment.referenceNumber}
              </p>
            </div>
          )}

          {!payment.referenceNumber && payment.status === "pending" && (
            <p className="text-xs text-muted-foreground">
              A payment reference will appear here once your claim is approved
              and the settlement is processed.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
