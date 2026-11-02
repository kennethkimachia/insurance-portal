/** Never construct security links from request Host headers or an implicit localhost fallback. */
export function portalInvitationRedirect(base: string | undefined, token: string) {
  if (!base || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Configure NEXT_PUBLIC_APP_URL before sending invitations.");
  const url = new URL(base);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTPS origin (HTTP is allowed on localhost).");
  return new URL(`/invitations/${token}`, url).href;
}

export interface ClerkInvitationClient {
  createInvitation(input: { emailAddress: string; redirectUrl: string; expiresInDays: number; ignoreExisting: boolean; notify: boolean; publicMetadata: Record<string, unknown> }): Promise<{ id: string }>;
  getInvitationList(input: { query: string; limit: number }): Promise<{ data: { id: string; status: string }[] }>;
  revokeInvitation(id: string): Promise<unknown>;
}

/** No portal role is placed in an authentication ticket. Enrollment grants it later. */
export async function sendClerkInvitation(client: ClerkInvitationClient, input: {
  id: string; email: string; token: string; expiresAt: Date; baseURL: string | undefined;
}, now = new Date()) {
  const remaining = input.expiresAt.getTime() - now.getTime();
  if (remaining <= 0) throw new Error("This invitation has expired. Resend it first.");
  return client.createInvitation({
    emailAddress: input.email,
    redirectUrl: portalInvitationRedirect(input.baseURL, input.token),
    expiresInDays: Math.max(1, Math.ceil(remaining / 86_400_000)),
    ignoreExisting: true,
    notify: true,
    publicMetadata: { portalInvitationId: input.id },
  });
}

export async function revokeClerkInvitation(client: ClerkInvitationClient, id: string | null) {
  if (!id) return;
  const { data } = await client.getInvitationList({ query: id, limit: 10 });
  const invitation = data.find((entry) => entry.id === id);
  // Accepted tickets have already established identity; portal access is still
  // controlled by the local invitation. Revoked/expired/missing tickets are inert.
  if (invitation?.status === "pending") await client.revokeInvitation(id);
}
