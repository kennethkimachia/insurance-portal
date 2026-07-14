import { db } from "@/db";
import { user } from "@/db/schema";
import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/lib/session";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect(ROUTES.SIGNIN);

  const [profile] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, session.id))
    .limit(1);

  if (!profile) redirect(ROUTES.SIGNIN);

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your profile, email address, and password.
          </p>
        </div>

        <SettingsForm
          user={{
            name: profile.name,
            email: profile.email,
            emailVerified: profile.emailVerified,
            image: profile.image,
            role: profile.role,
          }}
        />
      </div>
    </div>
  );
}
