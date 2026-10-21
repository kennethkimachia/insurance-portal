/** Allow only portal continuations; never trust a redirect supplied in a URL. */
export function safeAuthContinuation(value: string | null | undefined): string {
  if (value && /^\/invitations\/[a-f0-9]{64}$/.test(value)) return value;
  if (value && /^\/dashboard(?:\/[a-z_-]+)*$/.test(value)) return value;
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s]/.test(value)
  )
    return "/dashboard";
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const parsed = new URL(value, "https://portal.invalid");
  const parts = parsed.pathname.split("/");
  if (
    parts[1] === "claims" &&
    parts.length === 3 &&
    uuid.test(parts[2]) &&
    !parsed.search &&
    (!parsed.hash || /^#(?:documents|add-evidence)$/.test(parsed.hash))
  )
    return value;
  if (
    /^\/claim-forms(?:\/(?:motor|burglary))?$/.test(parsed.pathname) &&
    !parsed.hash
  ) {
    const valid = [...parsed.searchParams.entries()].every(
      ([key, id]) =>
        ["policy", "draft"].includes(key) &&
        uuid.test(id) &&
        parsed.searchParams.getAll(key).length === 1,
    );
    if (valid) return value;
  }
  if (
    [
      "/claims",
      "/policies",
      "/notifications",
      "/settings",
      "/customers",
      "/agents",
      "/organizations",
    ].includes(parsed.pathname) &&
    !parsed.search &&
    !parsed.hash
  )
    return value;
  return "/dashboard";
}

export function invitationContinuation(token: string | null): string {
  return token && /^[a-f0-9]{64}$/.test(token)
    ? `/invitations/${token}`
    : "/dashboard";
}
