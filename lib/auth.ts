import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { nextCookies } from "better-auth/next-js";
import { sendEmail } from "@/lib/email";
import {
  getPasswordResetEmailHtml,
  getVerifyEmailHtml,
} from "@/lib/emailTemplates";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      organizationId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your Insurance Portal password",
        html: getPasswordResetEmailHtml(url),
        category: "password-reset",
      });
    },
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your Insurance Portal email",
        html: getVerifyEmailHtml(url),
        category: "email-verification",
      });
    },
  },
  plugins: [nextCookies()],
});
