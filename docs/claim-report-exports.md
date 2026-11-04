# Portable claim reports

**Export claim package** on a claim downloads `<reference>-claim-report.zip`.
The package contains:

- `report.html`: a standalone report readable in any web browser, including
  offline, with sections for the claim overview, preserved policy context,
  every submitted form answer, nested people and loss inventory, review findings,
  recorded decisions and settlement, supporting documents, information requests,
  work results, amendments, and chronological correspondence and case history.
- `documents/`: original file bytes, named with unique document references that
  match the report's linked evidence index. These files do not require a portal
  account or an expiring download link.
- `README.txt`: instructions for extraction, forwarding, printing, and any
  recorded documents excluded from the package.

Recipients must extract the complete ZIP and open `report.html`. The browser's
Print / Save as PDF command creates a printable report; the PDF contains the
index, while the ZIP carries the original files. Send the entire ZIP when
transferring a claim and its evidence to another internal system.

Staff exports are confidential internal review copies and include internal
findings, events and notes available to the exporter. Policyholder exports
include only shared events and notes and exclude internal assessments, preserving
existing visibility boundaries. The report distinguishes recommendations,
recorded decisions and settlement references; exporting does not make a decision,
change the workflow, or record a handoff as sent.

Original submission snapshots are preferred; saved or legacy answers and missing
forms are clearly labeled. Selected files without an upload record, incomplete
uploads, and blocked or quarantined evidence are listed explicitly. Only files
that pass existing claim/attachment access rules are packaged. Inspection and
file screening states are shown separately; these statuses do not assert that an
automated malware scan took place.

The endpoint rechecks access, attachment state and the organization/claim storage
prefix before each original is read. Bytes are streamed from private storage into
ZIP entries with backpressure, size checks and SHA-256 checks where recorded.
Storage keys, signed URLs and portal-only download links are absent from the
report. The response is private and uncached. If a file cannot be retrieved or
verified, or access changes, the stream fails; the UI waits for the entire package
before offering a download, so it does not silently save a partial package.
Standard ZIP limits are checked before export and during streaming.

The report uses escaped text, local CSS, no scripts, no remote assets and a
restrictive content security policy. Filenames are sanitized and prefixed by
unique document references to prevent collisions or paths escaping the package.
No schema migration or new environment variables are required.

Validation: synthetic motor and burglary reports, offline document links, ZIP
round trips with byte comparisons, missing/blocked evidence, internal visibility,
legacy data, interrupted streams, cancellation, size and integrity failures.
Live authenticated identity/storage integration should also be exercised in the
deployed environment.
