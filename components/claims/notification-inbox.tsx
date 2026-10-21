"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/app/actions/user/my-claims";
import type { getMyNotifications } from "@/app/actions/user/my-claims";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
export function NotificationInbox({
  notifications,
}: {
  notifications: Awaited<ReturnType<typeof getMyNotifications>>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Card className="mx-auto my-7 w-[calc(100%-2rem)] max-w-5xl sm:my-10 sm:w-[calc(100%-3rem)]">
      <CardHeader>
        <CardTitle className="portal-heading">Updates</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {notifications.length === 0 ? (
          <p className="portal-empty">
            You have no updates yet.
          </p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="portal-row -mx-2 flex flex-wrap items-start justify-between gap-3 rounded-lg px-2 py-5"
            >
              <div>
                <Link
                  className="text-sm font-medium underline-offset-4 hover:underline"
                  href={`/claims/${n.claimId}`}
                >
                  {n.message}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("en-KE")} ·{" "}
                  {n.read ? "Read" : "Unread"}
                </p>
              </div>
              {!n.read && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await markNotificationRead(n.id);
                        router.refresh();
                      } catch {
                        toast.error("Could not mark update as read");
                      }
                    })
                  }
                >
                  Mark read
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
