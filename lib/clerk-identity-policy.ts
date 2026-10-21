export function clerkEmailIsVerified(email: {
  emailAddress: string;
  verification?: { status: string } | null;
} | null | undefined): email is { emailAddress: string; verification: { status: string } } {
  return !!email && email.verification?.status === "verified";
}

/** Never transfer an existing portal identity from another Clerk account. */
export function canLinkClerkIdentity(linkedIds: string[], clerkId: string): boolean {
  return linkedIds.every((id) => id === clerkId);
}

export function clerkSessionIsCurrent(createdAt: number, validAfter: Date | null): boolean {
  return !validAfter || createdAt > validAfter.getTime();
}
