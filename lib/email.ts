import { MailtrapClient } from "mailtrap";

const TOKEN = process.env.MAILTRAP_API_KEY!;

const client = new MailtrapClient({
  token: TOKEN,
  testInboxId: Number(process.env.MAILTRAP_TEST_INBOX_ID!),
  accountId: Number(process.env.MAILTRAP_ACCOUNT_ID!),
  sandbox: true,
});

const sender = {
  email: "hello@example.com",
  name: "Insurance Portal",
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
}

export async function sendEmail({ to, subject, html, text, category }: SendEmailOptions) {
  try {
    const response = await client.send({
      from: sender,
      to: [{ email: to }],
      subject,
      html,
      text,
      category,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}