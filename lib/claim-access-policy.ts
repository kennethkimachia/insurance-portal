import type { Role } from "./permissions";

export type ClaimAccessPurpose = "read" | "manage" | "upload" | "comment";
export interface ClaimAccessResource {
  policyholderId: string;
  assignedAgentId: string | null;
  status?: string;
  createdBy?: string | null;
}

export function canAccessClaim(
  role: Role,
  actorId: string,
  claim: ClaimAccessResource,
  belongsToOrganization: boolean,
  purpose: ClaimAccessPurpose = "read",
) {
  if (role === "admin") return true;
  if (role === "user") {
    return purpose !== "manage" && claim.policyholderId === actorId;
  }
  if (!belongsToOrganization) return false;
  if (claim.status === "draft")
    return purpose !== "manage" && claim.createdBy === actorId;
  if (role === "head_agent") return true;
  return role === "agent" && claim.assignedAgentId === actorId;
}
