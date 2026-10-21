export type PortalDatabaseAvailability = "ready" | "setup-required" | "unavailable";
export type PortalDatabaseFailure = Exclude<PortalDatabaseAvailability, "ready">;
export type PortalReadResult<T> =
  | { status: "ready"; data: T }
  | { status: PortalDatabaseFailure };

/** Drizzle wraps PostgreSQL errors in cause. Never expose the query or parameters. */
export function portalDatabaseFailure(error: unknown): PortalDatabaseFailure {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && (current.code === "42P01" || current.code === "42703"))
      return "setup-required";
    current = "cause" in current ? current.cause : undefined;
  }
  return "unavailable";
}

export function portalTablesAvailability(tables: {
  actors: boolean; enrollments: boolean; roleOperations: boolean;
} | undefined): PortalDatabaseAvailability {
  if (!tables || [tables.actors, tables.enrollments, tables.roleOperations].some((value) => typeof value !== "boolean"))
    return "unavailable";
  return tables.actors && tables.enrollments && tables.roleOperations ? "ready" : "setup-required";
}

/** Skip all actor reads when cutover is incomplete; fail closed on query errors. */
export async function readWhenPortalReady<T>(
  readiness: () => Promise<PortalDatabaseAvailability>,
  read: () => Promise<T>,
): Promise<PortalReadResult<T>> {
  try {
    const status = await readiness();
    if (status !== "ready") return { status };
    return { status: "ready", data: await read() };
  } catch (error) {
    return { status: portalDatabaseFailure(error) };
  }
}

export const portalDatabaseMessages: Record<PortalDatabaseFailure, string> = {
  "setup-required": "Portal setup is incomplete. The portal administrator must complete the database setup before you can connect.",
  unavailable: "The portal is temporarily unavailable. Please retry in a moment.",
};
