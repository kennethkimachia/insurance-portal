import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main className="portal-document">
      <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href="/">
        Back to portal
      </Link>
      <h1 className="portal-heading">
        How this portal uses your information
      </h1>
      <p className="text-sm text-muted-foreground">
        This prototype is operated by{" "}
        {process.env.NEXT_PUBLIC_PORTAL_OPERATOR_NAME || "the portal operator"}.
        Your insurance organization and the third-party portal operator have
        different responsibilities. Ask your inviting agent for the
        operator&apos;s contact and the insurer&apos;s claims procedure.
      </p>
      <div className="space-y-4 text-sm">
        <p>
          The portal stores account and contact details, your policy profile,
          incident answers, supplied documents, and claim activity to help
          authorized staff review your report. It preserves your original
          submission alongside later corrections.
        </p>
        <p>
          You can read your own claims. Your assigned agent, authorized claims
          managers and platform administrators can access claims within their
          permitted responsibilities. Staff can keep internal review notes
          separate from messages visible to you.
        </p>
        <p>
          Documents are stored privately and held for manual inspection before
          policyholder download. Staff may download them for inspection. This
          prototype does not claim to provide an automated malware scan.
        </p>
        <p>
          A portal receipt confirms that your report was saved here. It does not
          confirm insurer coverage, insurer receipt, approval or payment.
          Insurer handoffs and outcomes are labeled when manually recorded or
          simulated.
        </p>
        <p>
          Only supply information relevant to the incident. Government ID scans
          and a profile photo are not required to open a portal account. Use
          synthetic identities and documents when demonstrating this prototype.
        </p>
        <p>
          You can add an amendment, reply to your agent, or request withdrawal
          from a claim&apos;s detail page. Withdrawal preserves the report and
          history. Contact the portal operator through your inviting agent to
          request help with account information, corrections or document
          retention.
        </p>
        <p>
          This page describes the prototype&apos;s behavior. The operator must
          publish its actual retention period and contact details before
          accepting real policyholder information.
        </p>
      </div>
      <Link className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href="/help">
        Get help with your claim
      </Link>
    </main>
  );
}
