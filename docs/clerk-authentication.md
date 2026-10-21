# Clerk authentication

This checkout uses `@clerk/nextjs` and the Insurance Portal application
`app_3KGUiNX8cvVS15Py8pI6ehhR6YC`. Clerk owns profiles and global roles; PostgreSQL
retains UUID references, insurance data, enrollment and access gates. There is no
webhook user mirror. The provider stays inside `<body>`, uses the shadcn theme,
and `proxy.ts` includes `/__clerk/:path*` after the API/TRPC matcher.

Read [the architecture](clerk-identity-architecture.md) for runtime behavior and
[the cutover runbook](clerk-cutover.md) for operator steps. **The new identity schema
must be manually applied before authenticated use; it has not been migrated.**

Sign-in, sign-up, recovery and profile settings use Clerk components. Sign-up alone
does not grant enrollment. Explicit invitation acceptance grants the intended
role through a retryable backend metadata operation before domain enrollment.
The approved bootstrap account has Clerk role `admin` and can connect through
`/auth/continue` after the database cutover and UUID mapping review.

Authorization requires current backend role, verified primary email, local
enrollment, and current organization/claim access. Session role claims are UI
hints only. Local revocation uses `portal_actors.sessions_valid_after`; sign out
and sign in after the cutoff. Existing Better Auth credentials and sessions are
unused and are not automatically imported into Clerk.

Never print environment files, expose `CLERK_SECRET_KEY` to the browser, or run
schema changes/seed imports without explicit approval. No automatic migration,
commit or deployment is part of this implementation.
