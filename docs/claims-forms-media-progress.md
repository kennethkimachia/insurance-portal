# Claim forms, media and progress improvements

Updated 2 November 2026. This work builds on the current implementation; it does
not replace the existing claims workflow or assume that a selected file is a
successful upload.

## Findings and changes

The existing portal already had Motor/Burglary branching, incomplete drafts,
resume links, explicit report declarations, optional police/evidence follow-up,
submission receipts, categorized evidence, retry identifiers, content-signature
checks, private downloads, evidence inspection, manager-only outcomes and an
audited public/internal timeline. Those controls remain.

### Claim forms

- Validation errors now list links back to the affected step/field, with a heading
  fallback for group-level errors. The current step has a focusable heading.
- A person can go from the essential incident/contact details directly to review,
  leaving optional follow-up and files for later. Final validation and both
  declarations still apply; a partially entered invalid optional answer still
  needs correction.
- Recorded policy dates are compared with exact or approximate incident dates.
  Warnings explain out-of-period/overlapping dates and unknown timing without
  preventing first notice or asserting that coverage is valid/invalid.
- The insurer policy number and portal record reference are distinguished in the
  policy context. Editing answers, branches or evidence clears the accuracy
  confirmation, so revised answers must be confirmed again.
- Existing saved drafts, file reminders, retry identifiers, review/edit controls,
  receipt recovery, optional later evidence, and unknown answers remain in use.

### Agent review desk

- The main claim workspace now surfaces documents awaiting a decision, replies
  awaiting review, withdrawal requests, and the last structured public update.
  Section links lead to the report, evidence, assessment, activity and composer.
- The assigned queue groups claims into review, follow-up and waiting work. It
  prioritizes withdrawal requests, overdue policyholder update commitments,
  received replies and evidence, with oldest-first ties. Search, product/stage
  filters and explicit oldest/newest sorting remain available.
- Evidence replies are labeled as the policyholder's replies in the staff view.
  When all outstanding requests have responses, the next-action panel asks staff
  to review them instead of asking the policyholder to respond again.
- Activity can be filtered to progress updates, documents, messages, or internal
  work. Events now include the actor's current display name. Existing detailed
  assessments, manual file inspection, handoffs and guarded status changes remain.

### Comprehensive progress communication

The previous task editor existed but was not connected to the main workspace.
It is now available there, alongside a structured update composer.

Agents can publish progress, evidence-review, survey, repair, insurer-follow-up,
delay and settlement updates. Each update records:

- A title and plain-language explanation.
- The next action and responsible party: agent, policyholder, insurer, surveyor,
  repairer, another party, or no action required.
- Waiting/blocker details; delay updates require an explanation.
- An expected next-update time, required for public updates and entered in
  Nairobi time. Public dates are commitments to communicate, not claim completion
  guarantees. Overdue commitments appear in the workspace and agent queue.
- An arranged appointment time, location/joining instructions and relevant
  contact details, when applicable. Future-date and calendar-date checks apply.
- Explicit public or internal visibility. Public updates create an in-portal
  notification; internal updates stay behind the existing staff access filters
  and create no policyholder notification.

Updates are append-only claim events using the existing metadata column. A
client-generated event ID prevents a lost-response retry from creating the same
update and notification again. Reusing that ID with another claim, actor or
content is rejected. Publication rechecks ownership/assignment/membership and the
current actor under locks, and increments the claim version. Closed claims must
be reopened by the existing manager workflow before receiving new updates.

The latest valid public update is summarized separately from internal activity.
Structured details remain readable in history. Policyholders can send a general
question to their assigned agent as well as replying to specific requests.

Supporting tasks can be added, completed, reopened or removed using the existing
audited operations. Completed tasks remain in history. Task controls now recover
from transport failures and refresh authoritative claim data. Task descriptions
are explicitly policyholder-visible; confidential discussion belongs in internal
updates/notes.

The journey distinguishes receipt, allocation, assessment, decision and
settlement. Rejection/withdrawal do not imply payment, and approval is separate
from a recorded settlement. Arbitrary supporting-task counts no longer produce a
percentage suggesting that the claim is nearly approved. Public structured
updates and supporting tasks are included in report exports; private activity is
excluded. Synthetic demo workspaces contain an example public progress update.

## Backblaze integration review

The existing design—browser multipart POST to the authenticated portal, then a
server-side AWS S3 SDK `PutObject` to Backblaze—is appropriate for the current
prototype. Browser multipart POST here is **not** a direct presigned POST to B2.
Backblaze supports S3-compatible uploads and signed downloads, but not browser
presigned POST uploads. Object ACLs are bucket-level rather than per-object, so
the bucket must be private. Sources: [Backblaze S3 compatibility](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api),
[Backblaze JavaScript SDK setup](https://www.backblaze.com/docs/cloud-storage-use-the-aws-sdk-for-javascript-v3-with-backblaze-b2).

Changes to the integration:

1. The storage client initializes lazily. Missing environment variables do not
   break imports, build, draft saving or reporting. All five required settings
   are validated on storage use, including `B2_REGION`, previously omitted from
   the upload configuration guard. Invalid storage configuration returns a safe
   503 response. The workspace explains when configuration is unavailable.
2. Cloud endpoints must be an HTTPS Backblaze S3 origin with a matching region;
   credentials, query strings and bucket paths in the endpoint are rejected.
   Explicit localhost S3 endpoints remain supported for the existing Docker
   setup. No fallback to another account/provider is attempted.
3. New uploads send exact length, content type, a base64 Content-MD5 transport
   checksum, and SHA-256 metadata. The server checks `HeadObject` length and hash
   metadata before marking the reservation ready. This confirms the expected
   object/metadata exists; it is not an independent download-and-rehash or a
   malware scan. References: [PutObject](https://www.backblaze.com/apidocs/s3-put-object),
   [AWS SDK checksum behavior](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-checksums.html).
4. SDK automatic checksum behavior remains `WHEN_REQUIRED` for compatibility.
   Requests use ordinary PutObject/HeadObject calls, without object ACLs or tags.
5. The browser requires both `success: true` and an attachment identifier. An
   HTTP 200 HTML page, empty JSON, or incomplete response cannot mark a file saved.
6. Unauthorized upload requests return 401. Origin, claim access, branch/category,
   filename, content signature, inventory association and capacity checks remain
   server-side. Unsafe filename/path characters are also rejected on selection.
7. Download signing first checks that the object exists. Download links still
   require claim access and the relevant review status, expire after five minutes,
   and force attachment/octet-stream download. Missing storage configuration is
   handled safely; raw provider errors are not printed with download failures.
8. The existing durable reservation, same-file retry digest, private storage key,
   interrupted-upload handling and lost-commit recovery are retained. A failed or
   uncertain finalization never blindly deletes a possibly committed object.

The supported media remains JPEG, PNG, WebP and PDF, with MP4, MOV and WebM in
media categories. Stock records also support CSV/XLSX. Content signatures are
screening checks, not complete parsers or malware scanning. The limits remain
50 MB per file, 20 files and 150 MB per claim, including retained reservations.

### Configuration to add later

Set these server-side variables using the actual bucket's settings:

```dotenv
B2_ENDPOINT=https://s3.<your-region>.backblazeb2.com
B2_REGION=<same-region>
B2_KEY_ID=<application-key-id>
B2_APP_KEY=<application-key>
B2_BUCKET_NAME=<private-bucket-name>
B2_FORCE_PATH_STYLE=false
```

Use a bucket-scoped application key, not a master key. Upload verification and
private downloads require both write and read capabilities. Deletion is needed
only for an explicitly authorized cleanup/check workflow. Configure the bucket
as private and review encryption/retention settings. Keep these values out of
`NEXT_PUBLIC_*`, Git, logs and chat. Restart the app after changing them. Do not
replace the signed URL's host with a CDN hostname.

No browser-to-B2 upload CORS configuration is needed for this implementation:
files go through the same-origin portal endpoint. If a future version uploads
directly to B2, it needs a separate presigned PUT/CORS design and must preserve
server-side reservation, access and integrity checks.

## Validation and remaining checks

Source checks cover the existing suite plus new regressions for storage
configuration, generated keys, S3 command inputs, verification failures, invalid
success responses, media containers, structured update validation, privacy,
retry identity, queue ordering, journey semantics and form navigation/date
warnings. Tests use synthetic inputs and mocked storage/transport calls.

Final results:

- 94 tests passed, no failures/skips/cancellations.
- TypeScript checks passed.
- Lint passed with the same three existing image warnings.
- Production build and whitespace checks passed.

No Backblaze credentials were added and no live object upload, invitation, account
change, database migration or deployment was performed. No new database schema
is required for these progress updates: they use existing events, notifications
and task tables. The earlier pending Clerk/onboarding schema setup still applies
if it has not been completed.

After credentials and test data are available, verify an authenticated photo,
video and PDF upload, failed/retried upload, refresh recovery, private bucket
access, manually inspected downloads, expired signed links, and another
policyholder/insurer's denials. Run an agent → policyholder progress update,
internal update, evidence reply, task change, manager outcome and report export.
Confirm public/internal content and notification behavior in the actual database.
Pure tests and a passing build do not establish those live provider/transaction
behaviors.

Deployment limitations remain: the portal buffers uploads, so hosting request
size, time and memory limits must accommodate 50 MB files. Long/large media may
need a separate direct multipart upload design. Retried writes can retain older
B2 object versions; configure lifecycle/retention deliberately. Aggregate abuse
limits, automated malware scanning, scheduled reminder delivery and insurer or
payment integrations are not provided by this change. Expected next-update times
are visible in the portal; they do not automatically send email reminders.
