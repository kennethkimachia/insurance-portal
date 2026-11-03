import { getSessionUser } from "@/lib/session";
import { dashboardRedirect } from "@/lib/dashboard-redirect";

export const dynamic = "force-dynamic";

// Redirect before starting a React render. Async redirect-only components can
// trigger invalid performance timestamps in Next.js 16's development runtime.
export async function GET(request: Request) {
  const session = await getSessionUser();
  return dashboardRedirect(request.url, session?.role);
}
