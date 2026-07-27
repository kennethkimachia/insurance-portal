import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function LogoutPage() {
  await auth.api.signOut({ headers: await headers() });

  // Explicitly clear session cookies from the browser so the stale token
  // doesn't trigger redirect loops in proxy.ts
  const cookieStore = await cookies();
  cookieStore.delete("better-auth.session_token");
  cookieStore.delete("__Secure-better-auth.session_token");

  redirect(ROUTES.SIGNIN);
}