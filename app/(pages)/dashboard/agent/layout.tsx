import { requireDashboardRole } from "@/lib/dashboard-access";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireDashboardRole("agent");
  return children;
}
