import { redirect } from "next/navigation";
import { safeAuthContinuation } from "@/lib/auth-navigation";

export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  redirect(`/auth/continue?next=${encodeURIComponent(safeAuthContinuation(params.next))}`);
}
