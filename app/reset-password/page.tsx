import { redirect } from "next/navigation";

export default function ResetPasswordPage() {
  // Password recovery is handled by Clerk's sign-in flow.
  redirect("/sign-in");
}
