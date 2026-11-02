# Clerk authentication and invitation-only enrollment

Clerk owns authentication, profile settings, password recovery, email verification,
and invitation emails. PostgreSQL owns portal enrollment, insurer memberships,
policies, claims and audit records. There is no custom authentication/email
transport, webhook user mirror, or automatic email-based account reassignment.

## Required setup

1. Use keys from the same Clerk instance. In Clerk Dashboard → **Access mode**,
   select **Invite-only** (`restricted` in the API). This setting is required to
   prevent direct account creation through Clerk's hosted pages or frontend API;
   hiding a registration link alone cannot enforce it. Disable unused enterprise
   or social connections and review any remaining alternate provisioning paths.
2. Configure Clerk's invitation email/template and the app origin. Set
   `NEXT_PUBLIC_APP_URL` to the exact trusted app origin, with HTTPS outside
   localhost. Clerk owns email delivery; there are no separate mail credentials.
3. Apply the original reviewed database cutover if needed, then review/apply
   [the invitation upgrade](sql/invitation-onboarding-upgrade.sql). Fresh local
   databases use the current Drizzle schema. Do not replay legacy upgrades after
   the Clerk cutover. No database migration was applied during this task.
4. For an empty portal only, manually provision one verified first administrator
   in Clerk, set its backend `publicMetadata.portalRole` to `admin`, and set
   `PORTAL_BOOTSTRAP_CLERK_USER_ID` to that exact Clerk user ID. Connect through
   `/auth/continue`. Remove the bootstrap variable after enrollment. Other new
   administrators require an administrator invitation; an admin role by itself
   no longer bypasses enrollment. Existing enrolled/mapped accounts retain access.
5. Enable Clerk's appropriate password, bot, recovery and MFA settings. Staff MFA
   enforcement and real provider delivery need a separate live acceptance test.

## Invitation journey

- An authorized staff member records an existing insurer policy (or explicitly
  chooses synthetic demonstration data), confirms the holder's details, and
  creates an invitation. Only administrators invite staff or set staff roles.
- A portal invitation reserves the email, intended role and organization. Its
  256-bit local token is stored only as a SHA-256 digest. The portal asks Clerk to
  create/send a seven-day invitation with a redirect to that local review URL.
  Only the local invitation ID is placed in Clerk invitation metadata; no portal
  privileges are granted by an authentication ticket.
- Clerk adds `__clerk_ticket` when the recipient opens its email link. The review
  page links that ticket to `/sign-up/activate/<portal-token>`, which mounts Clerk's
  activation UI only for a currently pending local invitation. Bare `/sign-up`
  explains invitation-only access. Existing accounts sign in from the review page.
- The matching verified primary email must explicitly accept the local invitation.
  A retryable backend role operation confirms the Clerk role before atomically
  creating the policy/enrollment or staff membership and consuming the invitation.
- Resend checks a one-minute cooldown and conflicting reservations, revokes a
  pending previous Clerk ticket, rotates the portal token and expiry, and requests
  a new Clerk email. Revocation also revokes a pending Clerk ticket. Existing
  accounts are supported with `ignoreExisting: true`; a Clerk identity created
  earlier never bypasses local acceptance. Incomplete role operations must be
  resolved before resending/revoking.
- Delivery state means **requested through Clerk**, not inbox delivery confirmed.
  Failures remain visible and retryable. No messages were sent during source/test
  verification. Use a dedicated Clerk development instance and synthetic recipients
  for provider tests; local database/storage testing does not sandbox Clerk email.

Authorization requires current backend role, verified primary email, local
enrollment and the appropriate ownership, organization and assignment gates.
Session role claims are UI hints only. Local revocation uses
`portal_actors.sessions_valid_after`; sign out and sign in after the cutoff.

See [the architecture](clerk-identity-architecture.md),
[the historical cutover runbook](clerk-cutover.md), and
[the onboarding review/change report](onboarding-review-and-changes.md).
Never expose `CLERK_SECRET_KEY` or log invitation links/tickets. Historical auth
archives are unused; deletion requires a separate retention/rollback decision.
