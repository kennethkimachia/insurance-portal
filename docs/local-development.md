# Local Docker testing

Run the Next.js app on your machine with PostgreSQL in place of Neon and
SeaweedFS in place of Backblaze's S3 API. Both containers publish ports on
`127.0.0.1` only and retain their data in Docker named volumes. No Neon or
Backblaze account is required. Authentication still uses a **Clerk development
instance**; this is not a fully offline authentication environment.

## First run

Install Node.js 20.9+ (Node.js 22 LTS recommended), npm, and Docker with Compose
v2 supporting `up --wait`. Start Docker Desktop or your Docker daemon, then:

```sh
npm ci
npm run local:setup
```

On Windows, use `npm.cmd` if PowerShell blocks the `npm` script. The commands
otherwise work the same on Windows, macOS, and Linux.

Setup creates `.env.local` from [.env.local.example](../.env.local.example)
**only if that file does not exist**, starts the two services and waits for
health checks, applies the current Drizzle schema to the local database, then
checks a rolled-back database write and private storage upload/download/delete.
It preserves `.env`. If `.env.local` already points at cloud services, save that
file elsewhere and copy the local example into its place yourself; the local
commands refuse cloud URLs. No production/legacy cutover SQL is used.

Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_test_...`) and `CLERK_SECRET_KEY`
(`sk_test_...`) from the same Clerk development instance to `.env.local`, then:

```sh
npm run local:dev
```

Open <http://localhost:3000>. Restart the app after editing environment variables.
`.env.local` takes priority over `.env` in Next.js. The `local:*` commands read
`.env.local` explicitly and override inherited database/storage variables so a
shell-exported cloud URL cannot redirect the schema command.

## Sign-in and test data

The local database starts empty. Sign in with a verified Clerk development
account whose `publicMetadata.portalRole` is `admin`. Set
`PORTAL_BOOTSTRAP_CLERK_USER_ID` to that account's Clerk user ID, then visit
`/auth/continue` to connect it. Use the administrator screens to create test
insurers and invite test staff/policyholders; no production records or actors
are imported. See [Clerk authentication](clerk-authentication.md) for roles and
enrollment. Use a dedicated Clerk development instance for isolated identities,
because role/profile changes through the portal still update Clerk. Remove the
bootstrap variable after the initial enrollment. Set Clerk Access mode to
**Invite-only** before testing invitations.

Clerk sends invitation and authentication emails using its instance configuration.
No custom mail server or mail API key is needed. These emails are not captured by
the local Docker stack; use a dedicated development instance and synthetic test
addresses. Invitation status records the Clerk email request, not inbox delivery.
Existing `.env.local` files may contain retired email settings; the app ignores
them and they can be removed. See [Clerk setup](clerk-authentication.md).

The synthetic UI at `/prototype` is enabled by the local example. It does not
exercise database writes or uploads; use signed-in claims for those workflows.
The app's claim access and private evidence checks remain active locally.

## Services and commands

| Service | Host address | Local credentials |
| --- | --- | --- |
| Next.js | `http://localhost:3000` | Clerk development account |
| PostgreSQL 17 | `127.0.0.1:5433`, database `insurance_portal` | `portal` / `portal_local_password` |
| SeaweedFS S3 | `http://127.0.0.1:8333`, bucket `portal-evidence-local` | `portal-local` / `portal-local-secret` |

The storage bucket is pre-created on startup, requires credentials, and supports
the app's existing S3 client and presigned downloads. `B2_FORCE_PATH_STYLE=true`
keeps bucket names in URL paths, avoiding local bucket DNS requirements. The
normal Backblaze configuration defaults to its existing addressing behavior.
The local credentials are public development defaults, not production secrets.

```sh
npm run local:up       # Start existing services and verify storage; preserve data
npm run local:dev      # Start Next.js with validated local settings and Clerk test keys
npm run local:check    # Verify schema, transaction, private uploads, signed URLs, deletion
npm run local:db:push  # Apply later schema edits to this local database (interactive review)
npm run local:down     # Stop/remove containers and network; preserve both data volumes

docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail=100 postgres storage

npm test
npm run typecheck
npm run lint
```

The database/schema command is restricted to the exact Compose database, user,
password, and loopback URL in the example. Existing cloud databases still require
the reviewed [cutover procedure](clerk-cutover.md); never run a schema push on
them. The local schema is created from the current source rather than replaying
legacy migrations against an empty database. Schema changes that remove local
data retain Drizzle's interactive confirmation.

For port conflicts, edit `LOCAL_POSTGRES_PORT` and the port in `DATABASE_URL`
together, or `LOCAL_S3_PORT` and the port in `B2_ENDPOINT` together. To change the
app port, update `NEXT_PUBLIC_APP_URL`; `local:dev` uses that host and port.
Restart the services with `local:up` after changing Compose settings.

## Resetting disposable data

Stop Next.js first. **This command deletes all local database records and stored
files in this Compose project.** It does not delete Clerk users or metadata.

```sh
docker compose --env-file .env.local down --volumes
npm run local:setup
```

## Troubleshooting and limits

- Docker permission/connection errors: start Docker and ensure your user can
  access its socket. The setup requires a working `docker compose` command.
- Missing schema: run `local:db:push`, then `local:check`.
- Failed storage check: inspect storage logs and check the endpoint, port,
  credentials, and bucket in `.env.local`; anonymous downloads must be denied.
- Missing Clerk keys: add the two development keys to `.env.local`. Authentication
  is intentionally not bypassed. An existing `.env` with keys is not sufficient
  for `local:dev` when the local example contains blank key values.
- These services verify PostgreSQL and S3 behavior used by the app. Neon-specific
  infrastructure, Backblaze-specific policies/limits, real email, and Clerk
  integration require their own provider tests. SeaweedFS's other APIs are not
  published to the host.

Provider references: [SeaweedFS Docker and quick start](https://github.com/seaweedfs/seaweedfs),
[Drizzle schema push](https://orm.drizzle.team/docs/drizzle-kit-push).
