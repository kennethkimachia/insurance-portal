export type Role = "admin" | "head_agent" | "agent" | "user";

export const permissions = {
  // Claims
  CLAIM_READ: "claim:read",
  CLAIM_READ_OWN: "claim:read:own",
  CLAIM_READ_ASSIGNED: "claim:read:assigned",
  CLAIM_READ_ALL: "claim:read:all",
  CLAIM_CREATE: "claim:create",
  CLAIM_ASSIGN: "claim:assign",
  CLAIM_UPDATE_STATUS: "claim:update_status",
  CLAIM_DELETE: "claim:delete",

  // Policies
  POLICY_READ: "policy:read",
  POLICY_CREATE: "policy:create",
  POLICY_DELETE: "policy:delete",

  // Progress steps
  PROGRESS_CREATE: "progress:create",
  PROGRESS_UPDATE: "progress:update",
  PROGRESS_READ: "progress:read",

  // Notes
  NOTE_CREATE: "note:create",
  NOTE_READ: "note:read",

  // Customers
  CUSTOMER_READ: "customer:read",
  CUSTOMER_WRITE: "customer:write",
  CUSTOMER_DELETE: "customer:delete",

  // Agents
  AGENT_READ: "agent:read",
  AGENT_WRITE: "agent:write",
  AGENT_DELETE: "agent:delete",

  // Organizations
  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_WRITE: "organization:write",
  ORGANIZATION_DELETE: "organization:delete",

  // Invitations
  USER_INVITE: "user:invite",
  USER_MANAGE: "user:manage",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

/**
 * Maps each permission to the roles that are allowed to use it.
 */
const ROLE_PERMISSIONS: Record<Permission, Role[]> = {
  // Claims
  [permissions.CLAIM_READ]: ["admin", "agent", "head_agent", "user"],
  [permissions.CLAIM_READ_OWN]: ["user", "admin"],
  [permissions.CLAIM_READ_ASSIGNED]: ["agent", "admin"],
  [permissions.CLAIM_READ_ALL]: ["admin", "head_agent"],
  [permissions.CLAIM_CREATE]: ["user", "agent", "head_agent", "admin"],
  [permissions.CLAIM_ASSIGN]: ["head_agent", "admin"],
  [permissions.CLAIM_UPDATE_STATUS]: ["agent", "head_agent", "admin"],
  [permissions.CLAIM_DELETE]: ["admin"],

  // Policies
  [permissions.POLICY_READ]: ["admin", "agent", "head_agent", "user"],
  [permissions.POLICY_CREATE]: ["admin", "agent", "head_agent"],
  [permissions.POLICY_DELETE]: ["admin"],

  // Progress steps
  [permissions.PROGRESS_CREATE]: ["agent", "head_agent"],
  [permissions.PROGRESS_UPDATE]: ["agent", "head_agent"],
  [permissions.PROGRESS_READ]: ["admin", "agent", "head_agent", "user"],

  // Notes
  [permissions.NOTE_CREATE]: ["agent", "head_agent"],
  [permissions.NOTE_READ]: ["admin", "agent", "head_agent", "user"],

  // Customers
  [permissions.CUSTOMER_READ]: ["admin", "agent", "head_agent"],
  [permissions.CUSTOMER_WRITE]: ["admin", "agent", "head_agent"],
  [permissions.CUSTOMER_DELETE]: ["admin"],

  // Agents
  [permissions.AGENT_READ]: ["admin", "head_agent"],
  [permissions.AGENT_WRITE]: ["admin"],
  [permissions.AGENT_DELETE]: ["admin"],

  // Organizations
  [permissions.ORGANIZATION_READ]: ["admin", "head_agent", "agent"],
  [permissions.ORGANIZATION_WRITE]: ["admin"],
  [permissions.ORGANIZATION_DELETE]: ["admin"],

  // Invitations / user management
  [permissions.USER_INVITE]: ["admin"],
  [permissions.USER_MANAGE]: ["admin"],
};

/**
 * Check whether a given role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[permission];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Require a permission or throw. Useful in server actions.
 */
export function requirePermission(role: string | undefined, permission: Permission): void {
  if (!role || !hasPermission(role as Role, permission)) {
    throw new Error(`Unauthorized — requires "${permission}" permission`);
  }
}