# Insurance claims portal

A third-party insurance claims prototype for agent-invited policyholders. It supports **Motor and Burglary only**, with four roles: policyholder, agent, claims manager and platform administrator.

The portal provides verified invitation enrollment, draft/resume and immediate incident reporting, private categorized evidence with retry and manual inspection, claim detail pages, information requests and replies, public/internal activity, notifications, controlled assignments/outcomes, recorded withdrawal, and manual report export. Insurer integration and payments are deferred; manual/demo policy records, handoffs and outcomes are labeled.

## Local setup

Install the locked dependencies with `npm.cmd ci` on Windows. Use [.env.example](.env.example) as a configuration reference and keep test credentials private. Run `npm.cmd run dev`, then open the configured local application URL.

Authentication now uses Clerk. See [the Clerk setup and migration notes](docs/clerk-authentication.md) for the linked application, Clerk-owned profiles and roles, preserved UUID references, invitation enrollment, and session revocation. The [identity cutover runbook](docs/clerk-cutover.md) includes the required manually reviewed database change; it has not been applied. Existing Better Auth passwords and sessions are not imported automatically.

The expanded schema requires a **manual, reviewed database upgrade** before authenticated workflows can run. [Implementation and setup notes](docs/prototype-implementation.md) describe the phase order, existing-data handling, sandbox email, private test storage, upload reconciliation, retention and pending environment checks. No migration command is included in automated setup.

## Synthetic preview

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
