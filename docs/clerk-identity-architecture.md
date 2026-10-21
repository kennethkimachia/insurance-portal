# Clerk-owned identities and roles without webhooks

Implemented in source on 5 October 2026. Database cutover is prepared but has not
been executed. See [the cutover runbook](clerk-cutover.md) before using this checkout
against the existing database.

Clerk owns authentication, account name, primary verified email, avatar, and the
four global portal roles. PostgreSQL owns insurance data and application access.
The portal fetches current profiles when handling a request instead of mirroring
Clerk's directory. No webhook endpoint, webhook secret, or background user sync
is required.

| Data | Authority |
| --- | --- |
| Account profile, credentials, verified primary email, account ban | Clerk |
| `admin`, `head_agent`, `agent`, `user` | Clerk `publicMetadata.portalRole` |
| UUID to Clerk user ID reference | PostgreSQL `portal_actors` |
| Enrollment, insurance organization membership, portal suspension, access cutoff | PostgreSQL |
| Claims, policies, submitted contact details, notifications, evidence, audit | PostgreSQL |

`portal_actors` has no name, email, avatar, password, or global role column. It
retains the original UUID so existing foreign keys and historical ownership remain
stable. An unlinked legacy row cannot authenticate. A signup creates no portal
access until the account holder accepts an authorized invitation; an explicitly
assigned Clerk administrator may bootstrap enrollment through `/auth/continue`.

## Profile resolution and authorization

`lib/clerk-directory.ts` resolves only actor IDs obtained from authorized business
records. It batches at most 100 Clerk IDs per backend request and handles
pagination. Settings uses Clerk's `UserProfile`; changing a profile requires no
PostgreSQL synchronization button. Insurance contact phone remains separate in
`policyholder_enrollments`, because it is an agent-recorded business contact.

`lib/session.ts` requires a verified primary email, valid current backend role,
existing enrolled actor, and clear local access gates. Missing roles are not
silently converted to policyholders. A deleted/banned account cannot access the
portal. Historical references remain and display `Account unavailable` when its
profile no longer exists. Clerk outages fail requests rather than using cached
PostgreSQL identities or privileges.

Sensitive mutations re-read Clerk from the backend and recheck the actor under
PostgreSQL locks through `lib/transaction-identity.ts`. Organization memberships,
claim assignments, policy ownership, and draft privacy retain their existing
server-side checks. Client-editable unsafe metadata is never an authority.

## Insurance organizations

The original Better Auth configuration used only `nextCookies()`, not its
Organizations plugin. Its `organizationId` was a custom user field; the insurers
and agent memberships were application tables. There is therefore no Better Auth
Organizations integration to migrate to Clerk Organizations. Insurance
organizations remain PostgreSQL business records, linked to Clerk users through
their stable `portal_actors` UUIDs.

- A policyholder has one `policyholder_enrollments` row, keyed by actor UUID,
  with one required insurance organization. Invitations cannot enroll the same
  policyholder under another insurer. Adding another policy with the same insurer
  does not create another enrollment.
- Agents and claims managers can have multiple `agent_organizations` rows. Only
  a portal administrator can invite staff or add/remove these memberships. Staff
  roles are global Clerk roles and must be consistent across their organizations.
- Claim access checks the claim's organization against the staff member's current
  memberships. Agents additionally need the claim assignment; claims managers
  can manage submitted claims across their assigned organizations. A retained
  assignment cannot grant access after membership removal. Administrators must
  reassign open work before removing a membership.
- The active-organization cookie selects a view; it does not grant access. The
  server validates it against the authenticated account's memberships. Internal
  organization helpers are server-only, rather than remotely callable actions
  accepting a client-supplied session.

Clerk Dashboard organization memberships and organization roles are not read by
this architecture. Manage insurer memberships through the portal's administrator
controls; editing a Clerk user's global role does not add insurer membership.

## Session role claim

The custom session claim is deliberately small:

```json
{ "portal_role": "{{user.public_metadata.portalRole}}" }
```

It is available for UI hints. Server authorization reads backend metadata and
does not trust a potentially stale session role claim. Profile caches last one
server request; there is no shared authorization cache.

## Invitation acceptance and role updates

`lib/clerk-role-operations.ts` coordinates Clerk and PostgreSQL through persisted
`clerk_role_operations` rather than pretending they share a database transaction:

1. Authenticate the intended verified account, lock its local actor and invitation,
   validate expiry, suspension, policy conflicts, role and organization eligibility.
2. Persist the exact role intent and put the actor behind `pending_role_operation_id`.
3. Acquire a two-minute processing lease, validate domain eligibility, and update
   Clerk's backend-only public metadata. Keep other metadata keys intact.
4. Read Clerk back to confirm the role. In one PostgreSQL transaction, create the
   policy/enrollment or membership, consume the invitation, write audit history,
   and clear the access gate.

Failure preserves the operation and blocks access. The invited account can retry
from its invitation or `/auth/continue`; administrators can retry from the Admin
Dashboard. An idempotency key prevents repeated invitation acceptance creating
another policy. `portalRoleOperationId` identifies a remote write that succeeded
before a local failure. Retries refuse to overwrite an independent Dashboard role
change. The administrator's role controls use the same durable path and require
open assigned claims to be reassigned before changing a staff role.

Administrators may cancel an incomplete update. Cancellation restores the prior
Clerk role, records the cancellation, and suspends the actor with a session cutoff.
It does not finalize enrollment. A deleted Clerk account has no role to restore;
cancellation retires its actor permanently while retaining its historical UUID. The Admin Dashboard provides a separate reviewed
reinstatement action, which confirms the restored role and cleared operation
marker. Un-enrolled accounts then need a new invitation. Invitation resend/revoke
is blocked while that invitation has an incomplete role operation.

The queue is processed on demand, not by a background scheduler. If the browser
closes mid-update, the gate remains until a retry after the lease expires.

## Limits and operations

Clerk cannot be transactionally locked together with PostgreSQL. An independent
Dashboard edit can occur after the backend role check while an already-authorized
request is in flight. It applies on the next check; this implementation does not
claim instantaneous cancellation of that request. Use portal role controls for
coordinated role/domain changes. Direct Dashboard edits do not add memberships,
enrollment, policy records, or a complete local audit trail.

No polling means an account that never returns need not create a local reference.
Deleting a Clerk account preserves the insurance audit/ownership UUID. Recreating
an account with the same email does not inherit its records. Reassignment needs
an explicitly reviewed UUID mapping, never an automatic email match.

Existing mapped accounts retain their UUID through the prepared SQL. Unmapped
legacy accounts use a reviewed manifest and backend-only
`privateMetadata.portalActorId`; the account holder explicitly connects or accepts
an invitation. Legacy auth tables are archived for rollback and never used by the
new runtime. Removing that archive is a separate approved retention decision.

Official references: [user data and alternatives to syncing](https://clerk.com/docs/guides/development/webhooks/syncing),
[backend metadata updates](https://clerk.com/docs/reference/backend/user/update-user-metadata),
[user directory filters](https://clerk.com/docs/reference/backend/user/get-user-list).
