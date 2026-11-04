# Submitted claim and case work

The claim page opens on the readable submitted form. Its three sections are:

- **Claim form:** the preserved answers, named people, incident details, loss
  inventory, and policy context recorded at submission. Saved answers and legacy
  detail tables provide explicitly labeled fallbacks for older claims.
- **Evidence:** private image/PDF/video previews, original downloads, inspection
  results and tracked information requests. Upload controls are collapsed below
  the existing evidence.
- **Case work:** current actions, their results and follow-ups, contextual review
  and decision actions, correspondence, and one chronological case history.

## How the agent works a claim

1. **Record claim activity.** Explain what has happened for the policyholder,
   identify the next action and responsible party, and give an expected update
   time. Saving creates the tracked action, public history entry and one portal
   notification together. Retries with the same reference do not duplicate it.
2. **Record result / follow-up** on that action. Explain the result, then choose
   completed, follow-up required, approval recommended, rejection recommended,
   or closed without completion. A follow-up requires its action, responsible
   party and future time. The result closes the original work and creates the
   linked follow-up in the same transaction. It also communicates the result;
   there is no separate progress message to write for the same action.
3. When a result establishes a cost, select **This result includes an assessed
   cost or quotation** and record the amount and source. A related document can
   be selected from this claim. Cost fields are absent from the general claim
   review form. The most recently sourced cost is shown in decision review;
   older figures without a linked result are labeled as such.
4. **Review findings & decide claim** collects internal review findings and the
   decision actions. Staff can submit completed findings for a manager decision;
   submission checks outstanding work, information requests and inspections.
   It updates the claim stage and notifies the policyholder in the same save.
5. Managers and administrators have explicit **Reject claim** and **Approve
   claim** actions. Agents can record recommendations but cannot record those
   final outcomes. Other permitted actions, including reopening and settlement,
   are secondary controls in the same review area.

No product-specific processing sequence is imposed. The work can concern any
internal team, external professional, document, repair, investigation or insurer
response. The next action and result carry the relationship through the case.

Messages and confidential notes are optional correspondence actions in Case work.
Internal visibility remains enforced by the existing server-side filters. There
is no separate journey widget or always-open progress-update composer.

## Decisions and closure

A manager can reject an open submitted claim directly from review, with internal
assessment findings and a public explanation in the same confirmed action. An
agent's recommendation does not reject the claim. Approval still requires a
completed assessment and resolved work, information requests and inspections.

A final rejection, withdrawal or recorded settlement closes outstanding work
with an explicit `cancelled` result; it does not pretend that work succeeded.
Outstanding information requests close without implying that evidence was
supplied. The public decision, request closure and work results are audited in
one transaction. Original work and results remain in history. Closed claims
cannot receive new work/results until an authorized reopen; settlements remain
terminal. Approval is distinct from a recorded settlement or dispatched payment.

Work results are append-only `task_result` events using existing metadata. Their
request references are bound to the actor, claim, work item and normalized input.
Claim locks protect changes, and transaction failure rolls back the result,
follow-up, cost and notification together. Bare checkbox completion is disabled;
work closes with a recorded result and explanation. Active follow-up times also
feed the agent queue's overdue-update attention.

No schema migration is required. Existing task records remain available and can
receive results. Existing structured progress updates and notes remain readable
in case history, including appointment details.

## Evidence access

The existing attachment endpoint accepts `?preview=1` and returns a private,
five-minute storage URL after existing claim/document access checks. Previewable
types are JPEG, PNG, WebP, PDF and supported video; other types remain downloads.
PDF frames are sandboxed and use the storage origin. Responses are private and
uncached. Received files are viewable by authorized staff and the owning
policyholder while inspection is pending. Inspection acceptance is a separate
business decision. Incomplete, blocked or quarantined files cannot be opened,
and claim ownership and attachment-to-claim matching remain enforced.

Interrupted upload reservations have an explicit recovery check that verifies
length and SHA-256 metadata and fences the update against another attempt.
Recovery does not accept evidence, bypass closed-claim rules, replace storage
objects or constitute a malware scan.

Live identity, storage and authenticated claim behavior still require validation
in the deployed environment. Tests use synthetic records and transaction models;
expected update times do not schedule external email or automatic reminders.
