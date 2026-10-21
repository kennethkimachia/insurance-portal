"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  inviteAgent,
  revokeStaffSessions,
  setStaffSuspension,
} from "@/app/actions/admin/manage-agents";
import { StaffRoleControl } from "./staff-role-control";
import { InvitationList } from "@/components/auth/invitation-list";
import type { InvitationSummary } from "@/lib/invitations";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type StaffRole = "admin" | "head_agent" | "agent";
const roles: Record<StaffRole, string> = {
  admin: "Platform administrator",
  head_agent: "Claims manager",
  agent: "Agent",
};
interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  organizationName?: string;
  createdAt: string;
  suspendedAt?: string | null;
  pendingRoleOperationId?: string | null;
  clerkBanned?: boolean;
  emailVerified?: boolean;
}
export function ManageAgents({
  agents,
  invitations,
  organizations,
  currentActorId,
}: {
  agents: Staff[];
  invitations: InvitationSummary[];
  organizations: { id: string; name: string; code: string }[];
  currentActorId: string;
}) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("agent");
  const [organizationId, setOrganizationId] = useState("");
  const [tab, setTab] = useState<"staff" | "invitations">("staff");
  const [accessTarget, setAccessTarget] = useState<Staff | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  function createInvite(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await inviteAgent({ email, role, organizationId });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.info(result.message);
        setShowInvite(false);
        setEmail("");
        setOrganizationId("");
        router.refresh();
      } catch {
        toast.error("Could not create the invitation.");
      }
    });
  }
  function changeAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!accessTarget) return;
    startTransition(async () => {
      try {
        const result = await setStaffSuspension(
          accessTarget.id,
          !accessTarget.suspendedAt,
          reason,
        );
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(
          accessTarget.suspendedAt
            ? "Staff access reinstated"
            : "Staff access suspended; sessions revoked",
        );
        setAccessTarget(null);
        setReason("");
        router.refresh();
      } catch {
        toast.error("Could not change staff access.");
      }
    });
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <CardTitle>Staff access</CardTitle>
            <CardDescription>
              {agents.length} staff ·{" "}
              {invitations.filter((item) => item.state === "pending").length}{" "}
              active invitations
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowInvite((value) => !value)}>
            Invite staff
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInvite && (
          <form
            onSubmit={createInvite}
            className="space-y-3 rounded-lg border border-dashed p-4"
          >
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="staff-invite-email">Invited email</Label>
                <Input
                  id="staff-invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-invite-role">Staff role</Label>
                <select
                  id="staff-invite-role"
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                >
                  {Object.entries(roles).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="staff-invite-organization">
                  Insurance organization
                </Label>
                <select
                  id="staff-invite-organization"
                  className="h-9 rounded-lg border bg-background px-3 text-sm"
                  required
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                >
                  <option value="">Select organization</option>
                  {organizations.map((org) => (
                    <option value={org.id} key={org.id}>
                      {org.name} ({org.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A staff member keeps the same role across organizations. Existing
              policyholders cannot be promoted through an invitation.
            </p>
            <Button type="submit" disabled={pending || !organizationId}>
              {pending ? "Saving invitation…" : "Create invitation"}
            </Button>
          </form>
        )}
        <div
          className="flex gap-2"
          role="tablist"
          aria-label="Staff access views"
        >
          <Button
            id="staff-tab"
            role="tab"
            aria-controls="staff-panel"
            aria-selected={tab === "staff"}
            variant={tab === "staff" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("staff")}
          >
            Staff
          </Button>
          <Button
            id="invitations-tab"
            role="tab"
            aria-controls="invitations-panel"
            aria-selected={tab === "invitations"}
            variant={tab === "invitations" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("invitations")}
          >
            Invitations
          </Button>
        </div>
        {tab === "invitations" ? (
          <div
            id="invitations-panel"
            role="tabpanel"
            aria-labelledby="invitations-tab"
          >
            <InvitationList
              invitations={invitations}
              onChanged={() => router.refresh()}
            />
          </div>
        ) : (
          <div
            id="staff-panel"
            role="tabpanel"
            aria-labelledby="staff-tab"
            className="space-y-3"
          >
            {!agents.length && (
              <p className="portal-empty">
                No staff have accepted invitations yet.
              </p>
            )}
            {agents.map((agent) => (
              <div key={agent.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {agent.email}
                    </p>
                    {agent.organizationName && (
                      <p className="text-xs text-muted-foreground">
                        {agent.organizationName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{roles[agent.role]}</Badge>
                    <Badge variant="outline">
                      {agent.clerkBanned ? "Banned in Clerk" : !agent.emailVerified ? "Email unverified" : agent.pendingRoleOperationId ? "Access update pending" : agent.suspendedAt ? "Suspended" : "Active"}
                    </Badge>
                  </div>
                </div>
                <StaffRoleControl id={agent.id} role={agent.role} disabled={pending || agent.id === currentActorId || !!agent.suspendedAt || !!agent.pendingRoleOperationId || !!agent.clerkBanned || !agent.emailVerified} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || agent.id === currentActorId}
                    onClick={() => {
                      setAccessTarget(agent);
                      setReason("");
                    }}
                  >
                    {agent.suspendedAt ? "Reinstate" : "Suspend"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          const result = await revokeStaffSessions(agent.id);
                          if (result.success) {
                            toast.success("Staff sessions revoked");
                            router.refresh();
                          } else toast.error(result.error);
                        } catch {
                          toast.error("Could not revoke sessions.");
                        }
                      })
                    }
                  >
                    Revoke sessions
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {accessTarget && (
          <form
            onSubmit={changeAccess}
            className="space-y-3 rounded-lg border bg-muted/20 p-4"
          >
            <p className="text-sm font-medium">
              {accessTarget.suspendedAt ? "Reinstate" : "Suspend"}{" "}
              {accessTarget.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Open claims must be reassigned before suspension. This access
              change is recorded and existing sessions are revoked.
            </p>
            <Label htmlFor="access-reason">Reason</Label>
            <Input
              id="access-reason"
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex gap-2">
              <Button disabled={pending || reason.trim().length < 5}>
                Confirm access change
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccessTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
