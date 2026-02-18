"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { OrgSwitcher } from "@/components/navigation/header/org-switcher";
import { NAV_ITEMS } from "@/components/navigation/header/header";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Settings, LogOut, Shield } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

type UserRole = "admin" | "head_agent" | "agent" | "user";

interface AppSidebarProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: UserRole;
  };
  currentOrganization?: { id: string; name: string; code: string };
  organizations?: { id: string; name: string; code: string }[];
  onOrganizationChange?: (orgId: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export function AppSidebar({
  user,
  currentOrganization,
  organizations,
  onOrganizationChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role),
  );

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="offcanvas" className="lg:hidden">
      {/* Sidebar header: brand + user card */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 font-semibold text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          <span>InsurePortal</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* User card */}
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-border">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        {/* Org switcher */}
        {organizations &&
          organizations.length > 0 &&
          onOrganizationChange &&
          currentOrganization && (
            <div className="mt-2 px-2">
              <OrgSwitcher
                current={currentOrganization}
                organizations={organizations}
                onChange={onOrganizationChange}
              />
            </div>
          )}
      </SidebarHeader>

      <SidebarSeparator />

      {/* Navigation links */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: settings + logout */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={ROUTES.SETTINGS}>
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="text-destructive hover:text-destructive"
            >
              <Link href={ROUTES.LOGOUT}>
                <LogOut />
                <span>Log out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
