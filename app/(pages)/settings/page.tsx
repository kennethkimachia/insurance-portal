import { ROUTES } from "@/lib/routes";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect(ROUTES.SIGNIN);

  const profile = session;
  return (
    <div className="min-h-[calc(100svh-4rem)] bg-background">
      <div className="portal-page max-w-3xl">
        <div className="mb-8">
          <h1 className="portal-heading">
            Settings
          </h1>
          <p className="portal-intro">
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
