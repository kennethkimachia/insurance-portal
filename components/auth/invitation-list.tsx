"use client";
import type { InvitationSummary } from "@/lib/invitations";
import {
  resendPortalInvitation,
  revokePortalInvitation,
} from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTransition } from "react";
import { toast } from "sonner";

export function InvitationList({
  invitations,
  onChanged,
}: {
  invitations: InvitationSummary[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  if (!invitations.length)
    return (
      <p className="portal-empty">
        No invitations have been created yet.
      </p>
    );
  return (
    <div className="space-y-3">
      {invitations.map((invite) => (
        <div key={invite.id} className="rounded-xl border bg-muted/15 p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="break-all font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                {invite.organizationName}{" "}
                {invite.policyType && `· ${invite.policyType}`} · expires{" "}
                {new Date(invite.expiresAt).toLocaleDateString("en-KE")}
              </p>
            </div>
            <Badge
              variant={invite.state === "accepted" ? "default" : "outline"}
            >
              {invite.state}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {invite.deliveryState === "sandbox"
              ? "Saved to sandbox inbox; recipient delivery was not attempted."
              : invite.deliveryState === "sent"
                ? "Email accepted by provider; recipient delivery unconfirmed."
                : invite.deliveryState === "failed"
                  ? `Delivery failed: ${invite.deliveryError || "Retry the invitation."}`
                  : "Awaiting delivery attempt."}
          </p>
          {(invite.state === "pending" || invite.state === "expired") && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await resendPortalInvitation(invite.id);
                      if (result.success) {
                        toast.info(result.message);
                        onChanged();
                      } else toast.error(result.error);
                    } catch {
                      toast.error("Could not resend the invitation.");
                    }
                  })
                }
              >
                {invite.deliveryState === "failed"
                  ? "Retry delivery"
                  : "Resend"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await revokePortalInvitation(invite.id);
                      if (result.success) {
                        toast.success("Invitation revoked");
                        onChanged();
                      } else toast.error(result.error);
                    } catch {
                      toast.error("Could not revoke the invitation.");
                    }
                  })
                }
              >
                Revoke
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
