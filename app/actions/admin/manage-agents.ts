"use server";

import { sendEmail } from "@/lib/email";
import { getInviteEmailHtml } from "@/lib/emailTemplates";
import { db } from "@/db";
import { agentOrganizations, invitations, organizations, user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { permissions, requirePermission } from "@/lib/permissions";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(), role: z.enum(["admin", "head_agent", "agent"]), organizationId: z.string().uuid(),
});

export async function inviteAgent(data: z.infer<typeof inviteSchema>) {
  try {
    const session = await requireSession();
    requirePermission(session.role, permissions.USER_INVITE);
    const parsed = inviteSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "A valid email, role, and organization are required." };
    const { email, role, organizationId } = parsed.data;

    const [organization] = await db.select({ id: organizations.id, name: organizations.name })
      .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!organization) return { success: false, error: "Organization not found." };

    const [existing] = await db.select({ id: invitations.id }).from(invitations)
      .where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.organizationId, organizationId), eq(invitations.status, "pending"))).limit(1);
    if (existing) return { success: false, error: "A pending invitation already exists for this email and organization." };

    const token = randomBytes(32).toString("hex");
    await db.insert(invitations).values({
      email: email.toLowerCase(), role, organizationId, invitedBy: session.id, token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-up?token=${token}&email=${encodeURIComponent(email)}`;
    const roleLabels: Record<string, string> = {
      admin: "Admin",
      head_agent: "Head Agent",
      agent: "Agent",
    };
    const displayRole = roleLabels[role] || "Agent";
    const html = getInviteEmailHtml(displayRole, inviteLink);
    const response = await sendEmail({
      to: email,
      subject: `Invitation to join ${organization.name} as ${displayRole}`,
      html,
    });
    if (!response.success) return { success: false, error: "Invitation saved, but the email could not be sent." };
    return { success: true };
  } catch (error) {
    console.error("Invite error:", error);
    return { success: false, error: "Failed to send invitation. Please try again." };
  }
}

export async function acceptInvitation(token: string) {
  const session = await requireSession();
  const [invitation] = await db.select().from(invitations)
    .where(and(eq(invitations.token, token), eq(invitations.status, "pending"))).limit(1);
  if (!invitation || invitation.expiresAt < new Date()) {
    return { success: false, error: "This invitation is invalid or has expired." };
  }
  if (invitation.email.toLowerCase() !== session.email.toLowerCase()) {
    return { success: false, error: "This invitation was issued to a different email address." };
  }

  await db.transaction(async (tx) => {
    await tx.update(user)
      .set({ role: invitation.role, organizationId: invitation.organizationId })
      .where(eq(user.id, session.id));
    if (invitation.role === "agent" || invitation.role === "head_agent") {
      await tx.insert(agentOrganizations)
        .values({ agentId: session.id, organizationId: invitation.organizationId })
        .onConflictDoNothing();
    }
    await tx.update(invitations).set({ status: "accepted" })
      .where(eq(invitations.id, invitation.id));
  });
  return { success: true };
}

export async function assignAgentToOrganization(agentId: string, organizationId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.AGENT_WRITE);
  const [[agent], [organization]] = await Promise.all([
    db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, agentId)).limit(1),
    db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1),
  ]);
  if (!agent || !["agent", "head_agent"].includes(agent.role)) {
    return { success: false, error: "Only agents and head agents can be assigned." };
  }
  if (!organization) return { success: false, error: "Organization not found." };

  const [assignment] = await db.insert(agentOrganizations)
    .values({ agentId, organizationId })
    .onConflictDoNothing()
    .returning({ id: agentOrganizations.id });
  if (!assignment) {
    return { success: false, error: "This agent is already assigned to the organization." };
  }
  return { success: true, assignmentId: assignment.id };
}

export async function removeAgentFromOrganization(assignmentId: string) {
  const session = await requireSession();
  requirePermission(session.role, permissions.AGENT_WRITE);
  const [assignment] = await db.delete(agentOrganizations)
    .where(eq(agentOrganizations.id, assignmentId))
    .returning({ id: agentOrganizations.id });
  return assignment ? { success: true } : { success: false, error: "Assignment not found." };
}
