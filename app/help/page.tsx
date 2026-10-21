import Link from "next/link";
export default function HelpPage() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <main className="portal-document">
      <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href="/">
        Back to portal
      </Link>
      <h1 className="portal-heading">Help with the claims portal</h1>
      <div className="space-y-4 text-sm">
        <p>
          If there is immediate danger, contact local emergency services. Filing
          a report in this portal does not dispatch emergency help or a
          surveyor.
        </p>
        <p>
          Use the invitation sent by your agent to create or connect an account.
          Verify your email, then explicitly accept the invitation. An expired
          or revoked link needs to be resent by the sender.
        </p>
        <p>
          You can report a Motor or Burglary incident without a police abstract
          or completed loss inventory. Enter what you know, use the unknown or
          approximate options, and add documents later.
        </p>
        <p>
          After submitting, keep your claim reference. Open the claim to see
          your assigned agent, requests, history and recorded outcome. Your
          receipt remains valid if a document upload fails; retry the failed
          files from that claim.
        </p>
        <p>
          If no agent has been assigned, contact the agent who invited you. Once
          assigned, the claim page shows your agent&apos;s available email and
          phone number.
        </p>
        {email && (
          <p>
            Portal support:{" "}
            <a className="text-primary underline" href={`mailto:${email}`}>
              {email}
            </a>
          </p>
        )}
        <p>
          Need to correct a report or stop processing it? Add an amendment or
          request withdrawal on the claim page. A manager reviews withdrawals
          while retaining the history.
        </p>
      </div>
      <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href="/privacy">
        How your information is used
      </Link>
    </main>
  );
}
