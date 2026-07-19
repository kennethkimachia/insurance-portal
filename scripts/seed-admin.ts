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

import * as readline from "readline/promises";

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n🔧 Create Admin User\n");

  const name = await rl.question("  Name: ");
  const email = await rl.question("  Email: ");
  const password = await rl.question("  Password: ");

  rl.close();

  if (!name.trim() || !email.trim() || !password.trim()) {
    console.error("\n❌ All fields are required.\n");
    process.exit(1);
  }

  // Defer heavy imports until after prompts to avoid stdin interference
  const { config } = await import("dotenv");
  config();

  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { eq } = await import("drizzle-orm");
  const { user, account } = await import("../db/schema/auth");
  const { randomUUID } = await import("crypto");
  const { hashPassword } = await import("better-auth/crypto");

  const db = drizzle(process.env.DATABASE_URL!);

  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, email.trim()))
    .limit(1);

  const userId = randomUUID();
  const hashedPassword = await hashPassword(password.trim());

  if (existing.length > 0) {
    // User exists — check if they have an account (may have been lost during migration)
    const existingAccount = await db
      .select()
      .from(account)
      .where(eq(account.userId, existing[0].id))
      .limit(1);

    if (existingAccount.length > 0) {
      console.log("\n⚠️  A user with that email already exists. Skipping.\n");
      process.exit(0);
    }

    // User exists but no account — recreate the credential account
    console.log("\n🔄 User found but missing account record. Recreating...");
    await db.insert(account).values({
      id: randomUUID(),
      accountId: existing[0].id,
      providerId: "credential",
      userId: existing[0].id,
      password: hashedPassword,
    });

    console.log("✅ Account record restored successfully!");
    console.log(`   Email: ${email.trim()}`);
    console.log(`   Password has been updated.\n`);
    process.exit(0);
  }

  await db.insert(user).values({
    id: userId,
    name: name.trim(),
    email: email.trim(),
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
  console.log(`   Name:  ${name.trim()}`);
  console.log(`   Email: ${email.trim()}`);
  console.log(`   Role:  admin\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to seed admin:", err);
  process.exit(1);
});
