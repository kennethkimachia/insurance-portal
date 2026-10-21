# Prototype implementation and handoff

Updated 3 October 2026. This implements the recommendations in [the original review](prototype-review.md). All changes remain uncommitted. No database migration, database write, live message, storage upload, or deployment was performed during implementation checks.

Authentication was replaced with Clerk on 5 October 2026. [The Clerk handoff](clerk-authentication.md) supersedes the authentication setup below: Clerk account signup is available publicly, while new portal profiles still require verified invitation enrollment. Earlier validation statements below describe the 3 October prototype.

The supported products remain **Motor and Burglary**. Roles remain **policyholder (`user`), agent, claims manager (`head_agent`), and platform administrator**. Insurer integration, coverage automation, automated fraud decisions, emergency dispatch, and payment processing are deferred.

## What changed

| Review area                      | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invitations and identity         | Staff and policyholder invitations have separate purposes. A policyholder invitation records contact and policy enrollment details without creating a password or account for the person. Signup requires a matching, pending invitation. Email verification precedes explicit acceptance. Acceptance locks the identity and invitation and consumes the invitation inside the same transaction as enrollment. Tokens contain 32 random bytes and are stored as SHA-256 digests. Resending rotates the secret and expiry; revocation and delivery recovery are visible. Existing accounts can accept through the same invitation page. |
| Role and organization boundaries | Claim reads, changes, uploads and downloads use the same ownership, assignment and membership policy. Staff-assisted reporting verifies the customer's policy and staff membership and retains the filing actor. Fresh identities and locked membership checks protect mutations. Policyholders belong to one organization and have at most one policy of each supported type. Pending invitations never grant access automatically.                                                                                                                                                                                                   |
| Account management               | Administrators can suspend or reinstate staff, revoke sessions, and remove memberships. Open assigned work must be reassigned before removal or suspension. Access changes are audited. Email changes require confirmation and verification; reset and signup failures are surfaced. Authentication endpoints and evidence uploads have process-local abuse limits.                                                                                                                                                                                                                                                                    |
| Reliable reports                 | A UUID is allocated in the browser before the first save and retained in the resume URL. Autosaves serialize through a queue. Drafts and submitted reports are distinct. Final submission locks this ID and atomically writes the report, detail rows, preserved policy/form snapshots, progress and event. Repeated submission of the same authorized ID returns the existing receipt. The pooled PostgreSQL driver supports these transactions.                                                                                                                                                                                      |
| Forms                            | Both journeys collect an immediate incident notice with contact details, known or approximate timing, a short account of the incident, and declarations. Police documents, estimates and completed inventory are optional. Motor branches cover accident, theft and other damage. Burglary branches cover premises use, discovery/timing, alarm relevance, entry and loss inventory with quantity and alternative ownership evidence. Review/edit steps, draft timestamps, exit warnings, associated labels and focused errors are provided.                                                                                           |
| Validation                       | The same bounded schemas serve forms and server submissions. Final validation rejects invalid/future dates, inconsistent timing and police/alarm answers, malformed money, duplicate item/upload IDs and invalid loss-item links. Money totals use integer minor units and BigInt multiplication. Draft validation permits incomplete answers without treating them as a submitted report.                                                                                                                                                                                                                                             |
| Evidence                         | Categories and inventory associations persist. The authenticated multipart endpoint checks origin, access, branch/category, size, filename, MIME and content signatures. Limits are 50 MB per file, 20 files and 150 MB per claim. A durable reservation and SHA-256 digest precede object storage. Success, failure and interrupted-upload states are visible. Retries retain the client upload ID; confirmed files are skipped. Private objects remain at tracked keys after an uncertain result, for retry or operator reconciliation.                                                                                              |
| Evidence access and inspection   | New files wait for manual inspection. Policyholders cannot download pending or rejected files. Authorized staff can download ready files for inspection, then accept, request replacement, or explicitly waive with a reason. No automatic malware scan is claimed. Download URLs expire after five minutes and force attachment download. File keys and signed URLs are excluded from client data and report exports.                                                                                                                                                                                                                 |
| Claim follow-up                  | Every claim has an authorized detail URL with the original report, amendment history, public requests/replies, documents, next action, milestones and agent contact. Internal notes and assessment information stay private to staff. A notification inbox links to claims and tracks read state. Same-date reports warn about a possible duplicate without blocking another incident.                                                                                                                                                                                                                                                 |
| Workflow and outcomes            | Assignment/reassignment, evidence requests, inspections, assessment, stage changes and withdrawal are recorded with actors and reasons. Status transitions are constrained by stage and role. Assessments and accepted/waived evidence are prerequisites for progression; only managers record outcomes. Milestones follow workflow operations; custom tasks are supporting work. Submitted reports are preserved; only unsubmitted drafts can be deleted. Closed claims show their outcome instead of asking for unavailable responses.                                                                                               |
| Management and policy data       | Assigned and organization queues have search and stage/product filters. Open workload excludes closed claims, and managers can identify overdue information and unassigned work. Charts count claims by stage. Organization changes show a loading state and reset the workspace; claim work opens one shared detail page. Policy profiles record source, dates, asset, coverage summary and insurer reference; managers/admins can revise them with version checks and audit. Submission snapshots retain earlier profiles.                                                                                                           |
| Honest handoff and settlement    | JSON report export includes the original answers, policy snapshot, public amendments, evidence manifest, requests and recorded outcome. It does not transfer evidence bytes to an insurer. An external reference can record a manual or simulated handoff. Settlement requires a positive amount, a reference and source; the UI does not infer payment from status.                                                                                                                                                                                                                                                                   |
| Demonstration and support        | `/prototype` and `/prototype/forms` provide repeatable synthetic, non-mutating previews in development only, with all four roles and both products. Reporting, updates and help are reachable from navigation. Privacy/help pages explain operator versus insurer responsibilities. The existing visual system is retained, with brighter dark-theme green links to improve readability.                                                                                                                                                                                                                                               |

## Database handoff

The code requires the expanded schema. **It has not been applied.** A read-only
inspection on 5 October 2026 confirmed that the connected database still has the
original schema. Existing authenticated pages should not be used with the new
code until an operator has completed the schema upgrade in an isolated test
environment. Complete both phases below **before** the Clerk identity cutover;
the [Clerk runbook](clerk-cutover.md) lists the exact order. The Clerk cutover
archives `user`, so this legacy upgrade cannot be run afterwards.

1. Have the database owner review a backup and the actual existing tables against [prototype-schema-upgrade.sql](prototype-schema-upgrade.sql). This is an upgrade for the existing portal, not an empty-database bootstrap.
2. Apply its enum additions in **phase 1**, separately, and commit that database transaction before using the new values.
3. Apply the complete **phase 2** transaction after phase 1. It includes the invitation/auth changes, additive claim/policy/evidence fields, event tables, indexes and preservation triggers. [auth-schema-changes.sql](auth-schema-changes.sql) is a partial reference already included in phase 2; do not apply it as another upgrade.
4. The upgrade retires pre-hash invitation secrets once and expires their pending links. Resend or replace them from the portal. It deliberately leaves old original-submission, coverage, payment, actor and handoff fields unknown. Older notes default to internal visibility, and older documents require inspection. Legacy progress rows remain supporting tasks.
5. Retain the existing one-policy-per-type uniqueness constraint. Review any legacy accounts or policies attached across different organizations before test enrollment; do not silently merge identities.
6. Verify UTC storage/session timezone and backup/restore behavior. The application pool requests UTC for existing timestamp-without-timezone columns; user-facing incident dates/times and request deadlines use Nairobi time.

The SQL adds append-only triggers for claim/access events and preserves an existing original report and policy snapshot against replacement. Those guarantees require the handoff to be applied; application code alone is not proof that the database triggers are installed.

## Running the synthetic preview

Install the locked dependencies, then enable the preview only for the local development process:

```powershell
npm.cmd ci
$env:PORTAL_DEMO_ENABLED = 'true'
npm.cmd run dev -- --port 3001
```

Open `http://localhost:3001/prototype` for synthetic policyholder/agent/manager/admin claim workspaces, or `http://localhost:3001/prototype/forms?policy=motor` and `?policy=burglary` for interactive forms. Workspace actions and downloads are disabled. Form saves stay in page memory; “Validate preview” checks the form without submitting a report or file. Refresh starts that preview form again. The preview is always disabled in production, even if its environment flag is true.

## Running an isolated account workflow

Use `.env.example` as a configuration reference. Do not copy production credentials into demonstrations. Both application/auth URLs must match the port and origin used for that environment. Configure the portal operator name and a real support address before showing the prototype to others.

- **Database:** use a dedicated test PostgreSQL database compatible with `pg.Pool` transactions and the manually reviewed expanded schema. No runtime connection is created merely by importing the pool.
- **Initial administrator:** use an existing, verified administrator in that test environment, or have the database owner perform a controlled bootstrap. Public signup has no administrator bypass. The existing seed script performs writes and is not part of validation or automated setup.
- **Email:** the default `PORTAL_EMAIL_MODE=disabled` deliberately prevents delivery. `sandbox` uses the explicitly configured Mailtrap inbox; UI delivery messages distinguish it from recipient email. `live` is an explicit operator setting for actual recipient delivery. Configure the sender, API key and positive sandbox inbox ID as applicable. Failed invites remain resendable and do not pretend delivery succeeded.
- **Evidence:** use a private test B2 bucket and restricted credentials. Confirm the bucket has no public access. Missing storage configuration leaves the claim submitted and asks for document retry. New files stay pending until manual inspection. No antivirus or content-disarm service is included in this prototype.
- **Topology:** authentication/upload limits are in memory per server process. Before multiple instances or real traffic, use shared rate-limit storage and confirm proxy/origin handling, maximum request size and upload timeout in the hosting environment.

## Upload reconciliation and retention

Files selected in a draft have only name/category/size/item reminders saved; browser `File` bytes must be selected again after refresh. In the same page, upload progress and failed files remain available for individual retry. Reselecting the same name/size/category recovers a failed or interrupted reservation, but the server also requires the same SHA-256 bytes and immutable association. A different replacement is a new upload; staff can explicitly waive a failed/rejected prior record with a reason.

An `uploading` reservation younger than five minutes refuses another attempt. After five minutes, an identical-file retry may take over. A fencing timestamp prevents an old attempt from finalizing or failing a newer reservation. An uncertain commit never triggers blind object deletion. `failed` or stale `uploading` rows retain the private storage key for operator reconciliation. They count toward the claim's evidence capacity until an operator applies an agreed retention process; a waiver allows workflow progression but does not erase the record or stored object.

For reconciliation, an authorized operator must inspect the reservation, private object existence, recorded SHA-256 and relevant events in an isolated/approved environment. Restore a confirmed upload through an audited procedure, retry the original file, or explicitly record why evidence is unavailable. Do not infer successful storage from a selected filename. Missing legacy storage objects require operator repair; generating a signed URL does not establish object existence.

There is deliberately no unattended retention job. Before collecting real records, agree a retention period, legal-hold process and correction/contact procedure. Delete approved retained evidence only with coordinated database/object-store handling and an audit record. Submitted claim records are not removable through the policyholder UI. Previously issued five-minute download URLs may remain usable until expiry after access is revoked.

## Validation and remaining environment checks

Local validation uses synthetic inputs and mocked transport only. The test suite covers invitation identity/purpose/expiry/revocation rules; safe auth continuations; ownership, assignment and membership access; workflow prerequisites; both forms; money and dates; draft-save serialization and lost responses; evidence signatures/capacity/reselection; per-file upload progress and retry; reference generation; and production preview isolation.

Commands used for validation:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

`typecheck` regenerates current Next.js route definitions before running TypeScript, avoiding stale definitions from an earlier build. Turbopack uses the configuration file's directory as its project root, and Tailwind scans only application, component and library sources. This also prevents generated caches from becoming stylesheet candidates during local development.

Verified locally on 3 October 2026:

- **41 tests passed**, with no failed, skipped or cancelled cases.
- **TypeScript and production build passed.** The build generated all portal, invitation, evidence, support and prototype routes.
- **Lint passed with no errors and three existing image-optimization warnings** in the example component, header and sidebar.
- **`git -c core.autocrlf=false diff --check` passed.** Changes remain uncommitted; this check does not stage them.
- **Browser checks used synthetic data at 390 × 844 and 1280 × 900.** Motor and Burglary progressed through optional follow-up and evidence to review and successful preview validation. Required declarations and invalid timing focus the affected control. Burglary quantity 2 at KES 100.25 produced KES 200.50; alarm relevance and business stock categories matched the answers. Motor theft omitted driver questions, driving-licence evidence and repair estimates.
- **All four role workspaces were inspected.** Preview mutation controls and downloads were disabled. The policyholder view excluded internal assessment and notes. Inspected layouts had no horizontal overflow and form controls had associated labels. Dark-theme primary colors were checked against the updated source and visually inspected.
- **The protected draft route redirected to sign-in with its original UUID resume URL**, also preserved by the password-recovery link. No sign-in, signup, verification or reset delivery was submitted during this check. A malformed invitation showed the recovery page. Public help/privacy returned HTTP 200; unauthenticated evidence download returned 401 and report export returned a non-disclosing 404. Responses included frame-denial and content-type protection headers.
- **Preview validation issued no report or upload mutations.** Per-file upload tests used mocked transport. Earlier development/browser diagnostics included a stopped server and the stylesheet-root failure; these were corrected and the affected route rechecked. This is not a claim that the browser's retained diagnostic history was empty.

The following checks remain for the operator after test schema and sandbox configuration are ready. They are essential environment proof, and are not claimed by passing compilation or pure tests:

1. New and existing invited account activation; wrong email; verified signup continuation; expiry/revoke/resend; concurrent acceptance; email failure and recovery; staff suspension/session revocation.
2. Authenticated negative access across every claim action, upload, download and export; membership removal and open-work reassignment; organization switching with real records.
3. Draft refresh and session expiry; repeated final submissions and transaction rollback; concurrent saves/assignment/status changes against the actual PostgreSQL driver.
4. B2 partial failure, process interruption, lost commit response, identical-file retry, missing object, manual acceptance/replacement/waiver and private bucket permissions.
5. Evidence request/reply/resolution, assessment prerequisites, rejection, withdrawal, reopening, settlement labeling and consistent notifications/milestones.

Insurer receipt, coverage, payments, provider delivery and production behavior remain unverified and outside this implementation's integrations.
