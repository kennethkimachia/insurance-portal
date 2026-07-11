import { getMyPolicies } from "@/app/actions/user/my-claims";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import ClaimsPageClient from "./claim-forms-client";

export default async function ClaimsPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect(ROUTES.SIGNIN);
  }

  const policies = await getMyPolicies();

  return <ClaimsPageClient policies={policies} />;
}
