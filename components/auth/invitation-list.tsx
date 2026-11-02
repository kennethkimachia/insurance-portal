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
              <p className="mt-1 text-xs text-muted-foreground">{{ admin: "Administrator", head_agent: "Head agent · claims manager", agent: "Agent", user: "Policyholder" }[invite.role]}{invite.policyNumber && ` · Portal reference ${invite.policyNumber}`}</p>
              {invite.acceptedAt && <p className="mt-1 text-xs text-muted-foreground">Accepted {new Date(invite.acceptedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p>}
            </div>
            <Badge
              variant={invite.state === "accepted" ? "default" : "outline"}
            >
              {invite.state}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {invite.deliveryState === "sent"
                ? "Invitation email requested through Clerk; recipient delivery unconfirmed."
                : invite.deliveryState === "failed"
                  ? `Delivery failed: ${invite.deliveryError || "Retry the invitation."}`
                  : "Awaiting delivery attempt."}
          </p>
          {(invite.state === "pending" || invite.state === "expired") && (
            <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Resending replaces the previous link. Allow one minute between emails. Revoking stops future acceptance; it does not remove access already accepted.</p>
            <div className="flex flex-wrap gap-2">
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
