# Insurance claims portal

An invitation-only insurance claims prototype for a school project. It supports **Motor and Burglary only**, with four roles: policyholder, agent, claims manager and platform administrator.

The portal provides verified invitation enrollment, draft/resume and immediate incident reporting, private categorized evidence with retry and manual inspection, claim detail pages, information requests and replies, public/internal activity, notifications, controlled assignments/outcomes, recorded withdrawal, and manual report export. Insurer integration and payments are deferred; manual/demo policy records, handoffs and outcomes are labeled.

## Local setup

Run PostgreSQL and S3-compatible storage locally with Docker, replacing Neon and Backblaze for testing:

```sh
npm ci
npm run local:setup
# Add Clerk development keys to the generated .env.local.
npm run local:dev
```

Open <http://localhost:3000>. On Windows, use `npm.cmd` if needed. See [local development](docs/local-development.md) for credentials, invitation email, verification, shutdown, port overrides, and data reset. Authentication still uses Clerk; database and file storage run locally.

For cloud-backed testing, use [.env.example](.env.example) as a configuration reference, keep credentials private, and run `npm run dev`.

Authentication now uses Clerk. See [the Clerk setup and migration notes](docs/clerk-authentication.md) for the linked application, Clerk-owned profiles and roles, preserved UUID references, invitation enrollment, and session revocation. The [identity cutover runbook](docs/clerk-cutover.md) includes the required manually reviewed database change; it has not been applied. Clerk handles invitation and authentication emails; public registration is disabled in the app. Configure Clerk **Invite-only** access mode and the explicit first-admin bootstrap as described in the setup notes.

Existing cloud databases require a **manual, reviewed database upgrade** before authenticated workflows can run. [Implementation and setup notes](docs/prototype-implementation.md) describe the phase order, existing-data handling, Clerk email, private test storage, upload reconciliation, retention and pending environment checks. The Docker setup creates the current schema only in its isolated local database; it does not run the legacy upgrade or modify cloud data.

## Synthetic preview

In local development, signed-in agents, claims managers, and administrators have
a **Demo role** selector above the dashboard. Choose Policyholder, Agent,
Claims manager, or Platform administrator to present each role in the same
browser. **Exit demo** restores the account's original role. The selection is
temporary and tied to the current sign-in; Clerk account roles stay unchanged.
The first policyholder switch adds Motor and Burglary demo policies to the
account, and subsequent switches reuse them. These use the normal database and
claims workflow. In the manager view, the presenter can assign a claim to
themselves, then switch to Agent to work on it. No extra account or configuration
is needed. Role switching is disabled outside development.

For a separate synthetic preview without database writes:

```powershell
$env:PORTAL_DEMO_ENABLED = 'true'
npm.cmd run dev -- --port 3001
```

Open [the local preview](http://localhost:3001/prototype). It offers synthetic claim workspaces for all four roles and interactive Motor/Burglary forms without database writes, email or file uploads. The preview requires development mode and is disabled in production.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The tests use synthetic inputs and mocked upload transport. They do not establish database, authentication-provider, email, B2, insurer or production behavior. See [the implementation handoff](docs/prototype-implementation.md) for validation evidence and the checks to run after the test environment is configured.

The original findings and delivery recommendations are preserved in [the prototype review](docs/prototype-review.md). Changes are left uncommitted for review.

## Onboarding review

For the school prototype, inviting a policyholder takes only their name, email,
and policy type (Motor or Burglary). The selected organization is filled in from
the dashboard. Accepting the invitation adds a demo policy automatically; phone
numbers, insurer references, coverage dates, and policy confirmation are not
required. Policy details can be edited later.

See [the onboarding review and change report](docs/onboarding-review-and-changes.md)
for the role design, research, implemented improvements, validation, remaining
prototype limits and required Clerk/database setup. The new invitation fields and
reference constraints have a [reviewable SQL upgrade](docs/sql/invitation-onboarding-upgrade.sql);
it has not been applied to existing databases.

## Claim forms, evidence and agent progress

See [the claims improvement report](docs/claims-forms-media-progress.md) for the
forms review, agent review desk, structured public/internal updates, supporting
tasks, Backblaze logic checks, required bucket/key settings and live-test limits.
Storage variables can be configured later; reports remain separate from uploads.
