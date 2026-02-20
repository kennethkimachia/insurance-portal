import { MailtrapClient } from "mailtrap";

const mailtrap = new MailtrapClient({
  token: process.env.MAILTRAP_API_KEY!,
  testInboxId: 4397927
});

mailtrap
  .send({
    from: { name: "Mailtrap Test", email: "sender@example.com" },
    to: [{ email: "recipient@example.com" }],
    subject: "Hello from Mailtrap Node.js",
    text: "Plain text body",
  })
  .then(console.log)
  .catch(console.error);