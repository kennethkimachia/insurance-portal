# Invitation-only onboarding: review and change report

Date: 1–2 November 2026. Scope: the existing Next.js/Clerk claims prototype, with
Motor and Burglary policies. This report distinguishes existing behavior, changes
made in this task, configuration still needed, and future work.

## Recommendation

Keep the four roles. Invitation-only access fits an insurer's existing customer
and staff population. A portal invitation links an authorized identity to an
existing insurance relationship; it should not sell insurance or issue coverage.
Use **Head agent / claims manager** for the dispatch and oversight role.

| Role | Appropriate prototype responsibilities | Boundary |
| --- | --- | --- |
| Policyholder (`user`) | Review recorded policies, report incidents, resume drafts, upload evidence, answer requests, follow history and outcomes | Own records only; cannot choose a staff role or assign a handler |
| Agent (`agent`) | Invite policyholders against checked policy records; process assigned claims, inspect evidence, request information, record assessment | Must belong to the insurer; claim access also requires assignment |
| Head agent / claims manager (`head_agent`) | Dispatch and reassign claims, balance workloads, handle delays, review assessments and record explained outcomes | Assigned insurers only; cannot invite staff or grant roles |
| Administrator (`admin`) | Invite staff, manage insurer memberships, roles, suspension and access recovery | Keep this as the exceptional operational role; routine allocation belongs to the head agent |

The current code allows an administrator broad claims access. I retained that
existing prototype design. For production, consider separating technical
administration from claim-content access, with reviewed emergency access.
A fifth role or automatic allocation is unnecessary for the demonstration.

## What the review established

The implementation was already stronger than a simple signup prototype. I kept
its 256-bit random invitation tokens, SHA-256 token storage, seven-day expiry,
verified primary-email matching, explicit acceptance, role/organization checks,
audited enrollment, and retryable Clerk role operations. The latter pause portal
access until the backend role and local enrollment agree.

The claim dispatch design also already fits the goal: a submitted report waits
for a manager to assign an active agent in the same insurer; assignment and
reassignment produce policyholder-visible history and notifications. Agents
handle assigned work; manager-only outcomes require explanations and readiness
checks. Inviting someone does not automatically assign their future claims to
the inviter. These behaviors were retained, not newly implemented in this task.

The gaps were general registration screens/links, custom email code left after
the Clerk migration, overly broad administrator bootstrapping, incomplete
invitation conflict handling, unclear policy identifiers, and onboarding controls
that were only reachable from the agent dashboard.

## Changes implemented

| Area | Before | Current source behavior |
| --- | --- | --- |
| Registration | Bare `/sign-up` mounted a general Clerk signup form; auth-shell and sign-in UI advertised signup | Bare or malformed activation paths show invitation-only guidance. Clerk activation UI requires a valid pending local invitation at `/sign-up/activate/<token>`. Public signup links are removed; sign-in disables sign-in-to-sign-up transfer |
| Invitation emails | A custom email transport and custom HTML templates handled portal invitations | Clerk `createInvitation()` sends the email and returns a tracked Clerk invitation ID. Email redirects to the portal review page with Clerk's authentication ticket |
| Email cleanup | Mailtrap package, transport, templates, admin mode display and environment/local validation settings remained | Removed the package and its lockfile dependencies, `lib/email.ts`, `lib/emailTemplates.ts`, old configuration examples and runtime references. Current setup docs use Clerk only |
| Privilege timing | Local acceptance already used a durable role operation | Preserved it. Clerk invitation metadata contains only the portal invitation ID, not a portal role; authentication itself grants no domain access |
| First admin | Any verified Clerk account with an admin role could bootstrap portal enrollment | Only the exact verified administrator selected by `PORTAL_BOOTSTRAP_CLERK_USER_ID` can bootstrap. Other new administrators need invitations. Existing enrolled accounts remain enrolled |
| Conflicting invitations | Duplicate checks were mainly scoped to organization and invitation purpose | Email advisory locks and reservation checks reject incompatible pending roles, staff-vs-holder invitations and policyholders reserved under different insurers. Different supported policy types under the same insurer remain possible |
| Duplicate policy records | Insurer references could be recorded against different people without a shared uniqueness rule | Creation/resend checks reject already-recorded or actively reserved manual references. Acceptance rechecks existing policies. A reviewed schema upgrade adds insurer-scoped, case/whitespace-normalized manual reference uniqueness |
| Resend/revoke | Only the local invitation token was rotated or revoked | Pending Clerk tickets are revoked too. Resends enforce a 60-second cooldown, recheck conflicting reservations, rotate the local secret and extend expiry. Incomplete role operations still block invitation changes |
| Delivery reporting | Custom transport modes included sandbox/live terminology | UI reports a Clerk email request, not confirmed inbox delivery; failures stay visible for retry. Role, portal reference and acceptance time are shown in invitation lists |
| Staff onboarding form | Defaulted to synthetic records; policy validation was duplicated and field errors were discarded | Defaults to manual existing-policy entry, shares policy-profile validation, shows field errors and requires staff confirmation. Confirmation resets when details change. Synthetic demonstration data remains an explicit choice |
| Recipient review | Showed role, organization and a masked portal reference | Also shows the recorded insurer policy number, asset, dates and coverage summary before acceptance, with instructions to ask for corrections |
| Discoverability | Policyholder invitation form existed only in the agent dashboard | The Customers page also exposes onboarding and invitation management to authorized staff in the active insurer |
| Transparency | Claim tools were present but onboarding did not explain the handoff clearly | Policyholder dashboard/help explain review → incident report → head-agent allocation → tracking and requests. Policy pages distinguish the insurer number from the portal reference |
| Missing schema | New invitation fields could be queried before an existing database was upgraded | Readiness now checks the Clerk invitation column; activation/review pages show setup or temporary-unavailability guidance instead of querying an incomplete schema |
| Sensitive links | Invitation page had a no-referrer metadata tag but global headers used same-origin | Auth/invitation routes also send no-referrer, private/no-store and noindex headers |

No active Better Auth integration or dependency remained in the checkout at the
start of this task. There is none in the current runtime. Earlier review/cutover
documents retain historical references and are marked as superseded. Historical
authentication tables/archives were not dropped; they are unused by the runtime
and may still matter for rollback or retention. Private environment files were
preserved; retired mail settings in them are ignored and may be removed locally.

## Policy number decision

A real insurer policy number already exists before the customer is invited.
The manual flow therefore requires it, together with coverage dates, insured
asset, coverage summary and the holder's details. Staff confirmation is an
attestation against the insurer's records; there is no automated insurer lookup.

The portal separately generates `MAN-MOT-<24 hexadecimal characters>` or
`MAN-BRG-<24 hexadecimal characters>` for a manual record, with `DEMO` replacing
`MAN` for synthetic records. The random portion has 96 bits of entropy and
contains no personal information. The reserved invitation reference and final
policy reference are checked by database uniqueness constraints. No existing
policy numbers were regenerated. These identifiers identify records, not
permissions or proof of coverage.

The retained prototype limit is **one insurer per policyholder account and one
policy of each supported type**. Supporting two vehicles, renewals or multiple
insurers needs a separate policy/membership model change. A policyholder may need
access to an expired policy to report an earlier loss, so onboarding does not
silently treat today's date as a coverage decision. Actual coverage remains a
claim review responsibility.

## Research and prototype feature priorities

Clerk distinguishes account invitations from restricting registration. Its
Invite-only mode must be enabled separately; local page checks cannot close its
hosted/API registration paths. Its invitation API supplies expiry, redirects and
existing-account support; authentication tickets may verify identity before the
portal grants access. The implementation uses these capabilities while keeping
enrollment authoritative locally. Sources: [Clerk access modes](https://clerk.com/docs/guides/secure/restricting-access),
[invitation API](https://clerk.com/docs/reference/backend/invitations/create-invitation),
[application invitation flow](https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations).

OWASP recommends explicit authorization, least privilege and checking access to
each resource. Its security-link guidance supports random, securely stored,
expiring single-use tokens, trusted HTTPS origins, referrer protection and
submission limits. The latter guidance concerns recovery links; applying those
properties to invitation links is an engineering inference, not a claim that
this prototype is certified. Sources: [authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html),
[security-link guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Claims guidance emphasizes communicating progress, explaining decisions and
making expected timing understandable. This supports showing ownership, waiting
reasons, requested actions and outcomes rather than merely a percentage bar.
These are product-design references, not a determination of applicable law:
[OECD claims-management recommendation](https://legalinstruments.oecd.org/en/instruments/100),
[Hong Kong Insurance Authority claims-handling expectations](https://www.ia.org.hk/en/legislative_framework/Conduct_in_Focus_Issue_07_%28Special_Supplement_02%29.html).

| Priority | Capability to showcase | State after this task |
| --- | --- | --- |
| Essential | Invite-only entry, intended email/role/insurer, expiry, resend, revoke, failed-delivery recovery | Implemented in source; provider mode and live integration tests still required |
| Essential | Recorded policy eligibility, clear insurer number, explicit manual/demo source | Improved here; insurer verification remains manual |
| Essential | Immediate incident reporting, drafts, optional later police/evidence documents | Existing implementation retained |
| Essential | Receipt/reference, current stage, responsible handler, next action, requests/replies, public timeline | Existing implementation retained; onboarding explanation improved |
| Essential | Private evidence, staff inspection, internal/private notes, ownership and organization isolation | Existing implementation retained; live negative-access checks remain required |
| Essential | Manual dispatch, workload view, reasoned reassignment and manager-reviewed outcomes | Existing implementation retained |
| Essential | Staff access revocation, audit history, help/privacy, synthetic demo scenarios | Existing implementation retained; setup/help updated |
| Next | Named next-update date, delay reason, service targets and escalation/complaint workflow | Information-request due dates exist; a general next-update promise and formal complaints workflow are not implemented |
| Next | Multiple same-type policies, renewals, staff MFA enforcement, finer admin access | Requires further modeling/configuration and dedicated acceptance tests |
| Before production | Delivery reconciliation/outbox, durable aggregate rate limits, monitored provider failures, retention/legal holds, automated malware scanning | Not completed; current resend cooldown is per invitation, not a global abuse control |
| Later integration | Insurer policy verification, insurer receipt, payment reconciliation | Deferred; manual/demo records must not imply integration |

## Required setup before an authenticated demonstration

1. Set Clerk **Access mode → Invite-only**. Review enabled identity providers and
   configure Clerk's invitation email/template. Set a correct HTTPS app origin
   outside localhost. These remote settings were not changed during this task.
2. Review/apply [the invitation schema upgrade](sql/invitation-onboarding-upgrade.sql)
   after any outstanding original prototype and Clerk cutover steps. It adds
   `invitations.clerk_invitation_id` and two unique indexes. Existing duplicate
   references must be resolved with the insurer before the indexes can succeed.
   It marks old sandbox delivery records for explicit Clerk resend; it does not
   send messages. Fresh local setup uses the current Drizzle schema instead.
3. For an empty portal, select the verified first administrator using the exact
   Clerk user ID and backend admin role, connect it, then remove the bootstrap
   setting. See [current Clerk setup](clerk-authentication.md).
4. Resend older outstanding portal invitations through Clerk. Older local-only
   emails lack Clerk's activation ticket. Use a dedicated development instance
   and synthetic recipients: Docker does not capture Clerk emails.
5. Exercise new/existing-holder and staff journeys, wrong emails, expired links,
   previous links after resend, revocation, two simultaneous acceptances,
   conflicting reservations, Clerk outages and failed database finalization.
   Confirm no role, policy, enrollment or membership is duplicated or leaked.
6. Demonstrate one policyholder report, head-agent dispatch, assigned-agent
   evidence request, policyholder reply, assessment and explained manager outcome.
   Verify the public timeline at each step and test another insurer's denials.

Clerk and PostgreSQL do not share a transaction. Role enrollment has durable retry
state; email issuance/revocation uses synchronous provider calls under local locks.
A provider success followed by a failed local commit can leave an untracked Clerk
ticket; this task does not implement a distributed delivery outbox. The local
invitation/role/enrollment checks still govern portal access. Provider failures
must be reviewed before claiming a resend/revocation succeeded. A previously
accepted Clerk identity may continue to exist after its portal invitation is
revoked; it gains no access from that fact alone. Suspending already-enrolled
staff is a separate administrative operation.

## Verification and limits

- `npm test`: **82 tests passed**, none failed/skipped/cancelled, including eight
  new onboarding/provider-policy regression tests, plus extended schema-readiness
  coverage. Clerk invitation API calls in those tests use mocks; they send no messages.
- `npm run typecheck`: passed.
- `npm run lint`: no errors; three existing image-optimization warnings remain.
- `npm run build`: production build passed after allowing the existing Google
  font download. The initial sandboxed attempt could not reach Google Fonts.
- Browser: `/sign-up` renders invitation-only guidance without registration
  inputs or signup links; 1280px and 390px checks showed no horizontal overflow.
  Sign-in hides Clerk's signup prompt. Malformed invitation recovery and the
  missing-schema activation screen were checked without submitting credentials.
  No authenticated onboarding or real provider email was exercised.
  An initial port-3000 hostname/proxy failure was bypassed using localhost:3001;
  Clerk's development browser bootstrap briefly returned 401s before recovering.
- `git diff --check`: passed. Source/dependency scan found no active legacy
  auth/mail transport imports or dependencies. Earlier unrelated local-development
  edits were preserved.

No existing database was migrated, no real invitation was sent, no account role
was changed in Clerk, and no deployment or commit was made. Passing source checks
is not proof of live delivery, provider restrictions, transaction behavior or
production readiness. The required configuration and authenticated acceptance
checks above remain outstanding.
