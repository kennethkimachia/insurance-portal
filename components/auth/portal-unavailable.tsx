import { AuthShell } from "./auth-shell";
import { Button } from "@/components/ui/button";
import { safeAuthContinuation } from "@/lib/auth-navigation";
import { portalDatabaseMessages, type PortalDatabaseFailure } from "@/lib/portal-database-policy";

export function PortalUnavailable({ status, next, administrator = false }: {
  status: PortalDatabaseFailure;
  next: string;
  administrator?: boolean;
}) {
  const retryUrl = `/auth/continue?next=${encodeURIComponent(safeAuthContinuation(next))}`;
  return (
    <AuthShell
      title={status === "setup-required" ? "Portal setup is incomplete" : "Portal temporarily unavailable"}
      description="Your Clerk account is signed in. Portal access will resume when the database is ready."
    >
      <div className="space-y-5">
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          {portalDatabaseMessages[status]}
        </p>
        {status === "setup-required" && administrator && (
          <p className="rounded-lg border bg-muted/20 p-4 text-sm leading-6">
            Complete the database cutover using the project&apos;s setup instructions, then retry.
          </p>
        )}
        <Button asChild className="w-full">
          {/* A document reload also retries when this is already the current URL. */}
          <a href={retryUrl}>Retry portal connection</a>
        </Button>
      </div>
    </AuthShell>
  );
}
