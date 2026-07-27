import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function LogoutPage() {
  await auth.api.signOut({ headers: await headers() });
  redirect(ROUTES.SIGNIN);
}