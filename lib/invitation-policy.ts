import { createHash, randomBytes } from "node:crypto";
import type { Role } from "./permissions";

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isInvitationToken = (token: string) =>
  /^[a-f0-9]{64}$/.test(token);
export const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const createInvitationToken = () => randomBytes(32).toString("hex");

export type InvitationState = "pending" | "accepted" | "expired" | "revoked";
export function invitationState(
  invitation: { status: string; expiresAt: Date; revokedAt?: Date | null },
  now = new Date(),
): InvitationState {
  if (invitation.revokedAt) return "revoked";
  if (invitation.status === "accepted") return "accepted";
  if (
    invitation.status === "expired" ||
    invitation.expiresAt.getTime() <= now.getTime()
  )
    return "expired";
  return "pending";
}

export function invitationAcceptanceError(
  invitation: {
    email: string;
    role: Role;
    purpose: "staff" | "policyholder";
    organizationId: string;
    status: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  },
  identity: {
    email: string;
    emailVerified: boolean;
    role: Role | null;
    organizationId: string | null;
    suspendedAt?: Date | null;
  },
  now = new Date(),
): string | null {
  if (invitationState(invitation, now) !== "pending")
    return "This invitation is no longer available. Ask the sender for a new link.";
  if (identity.suspendedAt)
    return "This account is suspended. Contact your portal administrator.";
  if (!identity.emailVerified)
    return "Verify your email before accepting this invitation.";
  if (normalizeEmail(invitation.email) !== normalizeEmail(identity.email))
    return "Sign in with the email address this invitation was sent to.";
  if (invitation.purpose === "policyholder") {
    if (invitation.role !== "user" || (identity.role !== null && identity.role !== "user"))
      return "Policyholder invitations cannot grant or change staff access.";
    if (
      identity.organizationId &&
      identity.organizationId !== invitation.organizationId
    )
      return "This policyholder account already belongs to another organization.";
  } else {
    if (invitation.role === "user")
      return "This staff invitation has an invalid role.";
    if (identity.role !== null && identity.role !== "user" && identity.role !== invitation.role)
      return "Staff roles must be consistent across organizations. Ask the administrator to correct the invitation.";
    if (identity.role === "user" && identity.organizationId)
      return "A registered policyholder cannot be promoted through a staff invitation.";
  }
  return null;
}

export function normalizedPhone(value: string): string | null {
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
}
