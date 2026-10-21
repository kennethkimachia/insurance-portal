import { MailtrapClient } from "mailtrap";

export type EmailMode = "disabled" | "sandbox" | "live";
export function getEmailMode(): EmailMode {
  const configured = process.env.PORTAL_EMAIL_MODE;
  return configured === "sandbox" || configured === "live"
    ? configured
    : "disabled";
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
}

export async function sendEmail(
  options: SendEmailOptions,
): Promise<
  | { success: true; mode: "sandbox" | "live" }
  | { success: false; error: string; mode: EmailMode }
> {
  const mode = getEmailMode();
  if (mode === "disabled")
    return {
      success: false,
      mode,
      error:
        "Email delivery is disabled. Configure PORTAL_EMAIL_MODE for sandbox or live delivery, then retry.",
    };
  const token = process.env.MAILTRAP_API_KEY;
  const senderEmail = process.env.PORTAL_EMAIL_FROM;
  const testInboxId = Number(process.env.MAILTRAP_TEST_INBOX_ID);
  if (
    !token ||
    !senderEmail ||
    (mode === "sandbox" && (!Number.isInteger(testInboxId) || testInboxId <= 0))
  ) {
    return {
      success: false,
      mode,
      error:
        "Email configuration is incomplete. Contact the portal administrator.",
    };
  }
  try {
    const client = new MailtrapClient({
      token,
      sandbox: mode === "sandbox",
      ...(mode === "sandbox" ? { testInboxId } : {}),
    });
    await client.send({
      from: {
        email: senderEmail,
        name: process.env.PORTAL_EMAIL_FROM_NAME || "Insurance Portal",
      },
      to: [{ email: options.to }],
      subject: options.subject,
      html: options.html,
      text: options.text,
      category: options.category,
    });
    return { success: true, mode };
  } catch {
    console.error(`Portal email delivery failed (${mode}).`);
    return {
      success: false,
      mode,
      error:
        "The email provider could not accept this message. Retry delivery or contact the portal administrator.",
    };
  }
}

export async function sendEmailOrThrow(
  options: SendEmailOptions,
): Promise<void> {
  const result = await sendEmail(options);
  if (!result.success) throw new Error(result.error);
}
