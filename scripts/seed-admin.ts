// ============================================================
// Seed Admin Script
// Creates the initial admin user in the database.
//
// Prerequisites:
//   1. Make sure your .env file has a valid DATABASE_URL
//   2. Make sure the database tables have been pushed
//      (run: npx drizzle-kit push)
//
// Run this script with:
//   npx tsx scripts/seed-admin.ts
// ============================================================

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { user, account } from "../db/schema/auth";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);

  console.log("\n🔧 Create Admin User\n");

  const name = await prompt("  Name: ");
  const email = await prompt("  Email: ");
  const password = await prompt("  Password: ");

  if (!name || !email || !password) {
    console.error("\n❌ All fields are required.\n");
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log("\n⚠️  A user with that email already exists. Skipping.\n");
    process.exit(0);
  }

  const userId = randomUUID();
  const hashedPassword = await hashPassword(password);

  await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    role: "admin",
    organizationId: null,
  });

  await db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId: userId,
    password: hashedPassword,
  });

  console.log("\n✅ Admin user created successfully!");
  console.log(`   Name:  ${name}`);
  console.log(`   Email: ${email}`);
  console.log(`   Role:  admin\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to seed admin:", err);
  process.exit(1);
});
