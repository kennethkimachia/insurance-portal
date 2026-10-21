import { getMyNotifications } from "@/app/actions/user/my-claims";
import { NotificationInbox } from "@/components/claims/notification-inbox";
export default async function NotificationsPage() {
  return <NotificationInbox notifications={await getMyNotifications()} />;
}
