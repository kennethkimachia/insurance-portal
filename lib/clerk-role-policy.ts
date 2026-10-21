import type { Role } from "./permissions";

/** Prevent retries from overwriting a role changed independently in the Dashboard. */
export function roleWriteDecision(input: {
  operationId: string; previousRole: Role | null; desiredRole: Role;
  currentRole: Role | null; currentOperationId: unknown; invalidRole: boolean;
}): "write" | "already-applied" | "conflict" {
  if (input.invalidRole) return "conflict";
  if (input.currentRole === input.desiredRole && input.currentOperationId === input.operationId)
    return "already-applied";
  return input.currentRole === input.previousRole ? "write" : "conflict";
}

export function operationLeaseAvailable(status: string, expiresAt: Date | null, now: Date) {
  return ["pending", "blocked", "processing"].includes(status) &&
    (status !== "processing" || !expiresAt || expiresAt <= now);
}
