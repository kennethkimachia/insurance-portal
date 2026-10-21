# Clerk identity cutover and manual steps

Source implementation is ready. The database has not been migrated or written to
by this implementation task. This version requires the new tables and foreign
keys, so complete the database cutover before testing signed-in portal logic.
No commits or deployment have been made.

## Already completed through the Clerk CLI

Development application: `app_3KGUiNX8cvVS15Py8pI6ehhR6YC` (Insurance Portal).
Development instance: `ins_3KGUiMbWv0BjGy45X1IOOZr4jGf`.

- Confirmed CLI authentication as `kennethkimachia267@gmail.com`.
- Confirmed exactly one matching verified primary email for the approved bootstrap
  administrator, Clerk user `user_3KGZFSDWhBwn2zjgkVk24sS4d9f`.
- Merged `publicMetadata.portalRole = "admin"` into that user's metadata.
- Configured the custom session claim `portal_role` from
  `{{user.public_metadata.portalRole}}`, preserving other existing claims.
- `clerk doctor` passes development setup. Production is not configured.

The CLI supports both session configuration and user metadata through
`clerk config patch` and `clerk api /users/<id>/metadata -X PATCH --file ...`.
**No mandatory Clerk Dashboard changes remain for this development architecture.**
Do not create a webhook or configure a webhook signing secret.

## Database cutover: operator task

A read-only check on 5 October 2026 confirmed that the configured database is
reachable but has none of `portal_actors`, `policyholder_enrollments`, or
`clerk_role_operations`. This caused the reported `/auth/continue` query failure.
The updated runtime now shows a setup-required screen and blocks account
connection until all three tables exist, without exposing driver queries or
account parameters. Connection failures show a temporary-unavailability screen.
Retry performs a fresh request, so a completed cutover can be detected without a
process-wide cached failure. This guard does not apply the cutover or restore
authenticated database access on its own.

### Exact order for the currently connected database

A second read-only schema inspection confirmed that the database still has the
original portal schema. In addition to the three Clerk tables, it lacks the
prototype's claim/event/evidence additions, invitation enrollment fields, and
legacy `user.phone`/suspension columns. Applying the Clerk SQL alone would fail.
The database has four legacy actors, one policy and one insurer; preserve their
UUIDs rather than replacing it with an empty database. The read-only checks found
no policyholder role/organization conflict or ambiguous existing Clerk link.

After backup and rehearsal, use the SQL editor for the **same database used by
the app**, in this order:

1. In [prototype-schema-upgrade.sql](prototype-schema-upgrade.sql), run only
   **PHASE 1** (the three `ALTER TYPE` statements), then commit that transaction.
2. Run [the Phase 2-only file](sql/prototype-phase-2.sql) in full, from `BEGIN;`
   through `COMMIT;`. This is the complete phase extracted from the same source.
   This adds the business fields and event tables required by the current app.
3. Run [clerk-identity-cutover.sql](sql/clerk-identity-cutover.sql) in full, after
   phase 2 succeeds. Its prerequisite check now reports an omitted prototype
   upgrade before acquiring locks or copying records.
4. Complete the reviewed legacy UUID/Clerk role mappings described below, then
   click **Retry portal connection**. The approved Clerk administrator can connect
   after the schema is ready. If it owns legacy data, map its reviewed UUID first.

Run each stage separately; do not paste both prototype phases into one transaction.
Do not run [auth-schema-changes.sql](auth-schema-changes.sql) separately: it is
already included in prototype phase 2. Do not rerun either legacy upgrade after
the Clerk cutover, which archives the old authentication tables.

### Recovering a failed cutover transaction

If the cutover reports `Prototype schema upgrade is required` (SQLSTATE `P0001`),
its prerequisite check failed. A later `current transaction is aborted` or
`rollback required` message is the consequence, not a different root cause.

1. In the same SQL-editor session, run `ROLLBACK;` by itself. It clears the failed
   transaction; Phase 1 changes that were already committed remain committed.
2. Run [the complete Phase 2-only file](sql/prototype-phase-2.sql) as one
   transaction, and confirm that its `COMMIT;` succeeds. `Already exists,
   skipping` notices are expected for columns from a partial earlier attempt.
   An `ERROR` requires rollback and investigation of that first error.
3. Only after Phase 2 succeeds, run the full Clerk cutover as a new transaction.

A subsequent read-only check confirmed that Phase 1's three enum values are
present and some Phase 2 columns exist, but `audit_events`, `claim_events`, and
`evidence_requests` are missing. Neither the Clerk tables nor its archive exist.
The reported cutover error correctly identifies those missing prerequisites.
The coding agent has not executed any migration or SQL rollback.

### Review and recovery

1. Back up the database, record existing table/constraint counts, and rehearse on
   a copy. Stop the app's writes during cutover. The SQL assumes the currently
   defined legacy schema, including suspension and enrollment columns; inspect
   the actual database before applying it. It has not been rehearsed against a
   real database in this task.
   For the currently connected original schema, complete both prototype phases
   above before executing the Clerk cutover.
2. Review [the prepared SQL](sql/clerk-identity-cutover.sql). It creates
   `portal_actors`, `policyholder_enrollments`, and `clerk_role_operations`; copies
   existing UUIDs and explicit Clerk links; preserves suspension/session cutoffs;
   and retargets business foreign keys. It aborts on ambiguous Clerk mappings or
   inconsistent policyholder organizations/roles.
3. The SQL archives `user`, `account`, `session`, and `verification` under
   `legacy_auth_*` names. It does not import passwords or remove historical
   records. The new code never queries those archives. Review archive access and
   retention independently; delete them only under your approved retention plan.
4. Run the reviewed SQL yourself during the maintenance window. No migration
   command has been run by the coding agent. Do not run an unreviewed automatic
   schema push, which could drop the archive or lose UUID references.
5. Verify actor counts, policy foreign keys, membership and claim references,
   suspension/cutoff values, and the read-only verification queries in the SQL.
   Existing business IDs must be unchanged. Review every unmapped actor before
   letting that person's new Clerk account enroll with a different UUID.
6. Complete role/mapping backfill below, then restart the app on this code and
   test an authenticated workflow. The old code requires the old auth tables, so
   reverting source alone is insufficient after the cutover. Restore the database
   backup together with the old checkout if you need rollback; account metadata
   changes in Clerk must also be reviewed separately.

## Existing account mapping and roles

Existing `account` rows with `provider_id = clerk` are preserved as
`portal_actors.clerk_user_id`. Other actors remain unlinked and cannot sign in.
Clerk is the role authority after cutover; the legacy database role is only a
review aid for the one-time backfill, never a runtime fallback.

Create a reviewed JSON manifest with actual values, not the placeholders below:

```json
[
  {
    "actorId": "<existing PostgreSQL actor UUID>",
    "clerkUserId": "<verified Clerk user ID>",
    "portalRole": "agent"
  }
]
```

Include the initial administrator's existing UUID if it already owns portal data.
Do not invent a new UUID or infer ownership solely from email. Review stable Clerk
IDs and business ownership. Accounts that do not exist in Clerk must first sign
up and verify their email (or follow a separately approved import plan).

The CLI mapping helper first validates all users and refuses conflicting existing
private UUID mappings. It only writes Clerk metadata; it never writes PostgreSQL.
It is deliberately restricted to the development instance:

```powershell
# Preview the explicit reviewed mappings; no writes.
npx.cmd tsx scripts/clerk-link-actors.ts C:\path\reviewed-mappings.json
# After review, explicitly apply Clerk metadata only.
npx.cmd tsx scripts/clerk-link-actors.ts C:\path\reviewed-mappings.json --apply
```

The helper sets `publicMetadata.portalRole` and backend-only
`privateMetadata.portalActorId`, merging other keys. Users then connect through
`/auth/continue` or explicitly accept an invitation; the original UUID is bound
to their Clerk ID. Do not run the old administrator seed or ID migration scripts.
There is no automatic profile copying or email-based record reassignment.

## Authenticated acceptance checks after cutover

- Sign out and sign in as the approved administrator. On `/auth/continue`, connect
  the account; verify the Admin Dashboard and profile controls.
- Invite a new verified policyholder for Motor or Burglary; verify one acceptance
  creates one policy and one enrollment. Repeating the request must not duplicate
  either. Check wrong-email, expired, revoked, and cross-organization denials.
- Invite an agent and claims manager; verify their memberships, assignment
  boundaries, draft privacy, and dashboard roles.
- As an administrator, assign an agent to two insurers. Confirm they can switch
  between those insurers and access their assigned claims in each, while a third
  insurer is denied even with a forged active-organization cookie or claim ID.
  Agents and claims managers must be unable to add their own memberships. Reassign
  open work before membership removal, then verify all claim operations are denied
  in the removed insurer even if an old assignment exists. A policyholder must be
  unable to accept an invitation for a second insurer.
- Change a name or verified primary email in Clerk. The portal must show the new
  profile on a new request with identical actor UUID and policy/claim ownership.
- Change a staff role through the portal, then inspect Clerk user public metadata.
  Suspend/reinstate and revoke sessions; old sessions must be denied and a fresh
  sign-in required. Clerk-wide bans/deletions must deny portal access too.
- Simulate a Clerk/API or PostgreSQL finalization failure in a controlled test
  environment. The operation must remain blocked, retry must complete once,
  and no incomplete actor may obtain portal privileges. Test simultaneous retries
  and a browser close after the Clerk write but before finalization.
- For cancellation, verify the restored role and suspension. Use the separate
  cancelled-update review controls to reinstate the account after confirming its
  role; un-enrolled accounts require a new invitation.

These database/authenticated acceptance tests remain unverified. Source checks
and synthetic tests do not prove live transactional behavior.

## Clerk Dashboard tasks that the CLI cannot perform

**None are required for the current development setup.** The administrator role
and custom claim were configured through the CLI. Existing-user role and UUID
mapping backfill also has a CLI helper once you review the identity mapping.

Production activation, domains/DNS, credentials, and live sign-in/provider checks
are a separate rollout. The application currently uses a development instance;
this task did not create or deploy a production configuration. If Clerk displays
its `Configure your application` callout, open it to review any application-specific
requirements before production. No unverified Dashboard-only requirement is
being asserted here.

## Verification performed

All 70 synthetic tests pass. TypeScript checks and the production build pass.
Lint has no errors and three pre-existing image warnings; diff whitespace checks
pass. The Clerk mapping helper was tested in read-only preview mode with a
synthetic UUID; no mapping was applied. Browser inspection confirms the public
Clerk sign-in and sign-up screens remain available. Clerk CLI checks confirm the
linked development app, account, bootstrap role, and role-claim configuration.
The runtime-error investigation used read-only database checks: the database was
reachable, all three required cutover tables were missing, and the production
actor-read helper returned `setup-required` with no actor data. Regression tests
cover missing/partial schema, connection errors, safe error output, recovery on
retry, administrator-only membership permissions, and denial of every claim
operation after staff membership removal. The signed-in continuation and live
membership workflows have not been verified; the collaborative browser was
unavailable during the final check.
The database cutover and authenticated database workflows remain operator tests.
