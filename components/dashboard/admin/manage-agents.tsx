"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Users, Mail, Shield } from "lucide-react";
import { useState } from "react";

type UserRole = "admin" | "head_agent" | "agent";

interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName?: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
}

interface ManageAgentsProps {
  agents: AgentUser[];
  invitations: PendingInvite[];
}

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  head_agent: "Head Agent",
  agent: "Agent",
};

const roleBadgeColors: Record<UserRole, string> = {
  admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  head_agent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  agent: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function ManageAgents({
  agents: initialAgents,
  invitations: initialInvites,
}: ManageAgentsProps) {
  const [agents] = useState(initialAgents);
  const [invites, setInvites] = useState(initialInvites);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole | "">("");
  const [tab, setTab] = useState<"agents" | "invitations">("agents");

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteRole) return;

    const newInvite: PendingInvite = {
      id: `inv-${Date.now()}`,
      email: inviteEmail.trim(),
      role: inviteRole as UserRole,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setInvites((prev) => [newInvite, ...prev]);
    setInviteEmail("");
    setInviteRole("");
    setShowInvite(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Agents &amp; Staff</CardTitle>
              <CardDescription>
                {agents.length} staff ·{" "}
                {invites.filter((i) => i.status === "pending").length} pending
                invite
                {invites.filter((i) => i.status === "pending").length !== 1
                  ? "s"
                  : ""}
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowInvite(!showInvite)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Invite form */}
        {showInvite && (
          <form
            onSubmit={handleInvite}
            className="mb-4 space-y-3 rounded-lg border border-dashed p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="agent@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Role
                </label>
                <Select
                  value={inviteRole}
                  onValueChange={(val) => setInviteRole(val as UserRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="head_agent">Head Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!inviteEmail.trim() || !inviteRole}
              >
                Send Invitation
              </Button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="mb-3 flex gap-1 rounded-lg bg-muted p-0.5">
          {(["agents", "invitations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "agents"
                ? `Staff (${agents.length})`
                : `Invitations (${invites.length})`}
            </button>
          ))}
        </div>

        {tab === "agents" ? (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {agent.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      roleBadgeColors[agent.role]
                    }`}
                  >
                    {roleLabels[agent.role]}
                  </span>
                  {agent.organizationName && (
                    <Badge variant="outline" className="text-xs">
                      {agent.organizationName}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {invites.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No invitations sent yet.
                </p>
              </div>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {invite.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invited{" "}
                        {new Date(invite.createdAt).toLocaleDateString(
                          "en-KE",
                          { day: "numeric", month: "short" },
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        roleBadgeColors[invite.role]
                      }`}
                    >
                      {roleLabels[invite.role]}
                    </span>
                    <Badge
                      variant={
                        invite.status === "pending"
                          ? "secondary"
                          : invite.status === "accepted"
                            ? "default"
                            : "outline"
                      }
                    >
                      {invite.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
