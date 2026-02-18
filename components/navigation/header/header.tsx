"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrgSwitcher } from "@/components/navigation/header/org-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Shield,
  Users,
  Building2,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

type UserRole = "admin" | "head_agent" | "agent" | "user";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

interface HeaderProps {
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

// ── Nav items by role ────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD_USER,
    icon: LayoutDashboard,
    roles: ["user"],
  },
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD_AGENT,
    icon: LayoutDashboard,
    roles: ["agent"],
  },
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD_HEAD_AGENT,
    icon: LayoutDashboard,
    roles: ["head_agent"],
  },
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD_ADMIN,
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    label: "Claims",
    href: ROUTES.CLAIMS,
    icon: FileText,
    roles: ["admin", "head_agent", "agent", "user"],
  },
  {
    label: "Policies",
    href: ROUTES.POLICIES,
    icon: Shield,
    roles: ["admin", "head_agent", "agent", "user"],
  },
  {
    label: "Customers",
    href: ROUTES.CUSTOMERS,
    icon: Users,
    roles: ["admin", "head_agent", "agent"],
  },
  {
    label: "Agents",
    href: ROUTES.AGENTS,
    icon: Users,
    roles: ["admin", "head_agent"],
  },
  {
    label: "Organizations",
    href: ROUTES.ORGANIZATIONS,
    icon: Building2,
    roles: ["admin"],
  },
];

// ── Component ────────────────────────────────────────────────────────────

export function Header({
  user,
  currentOrganization,
  organizations,
  onOrganizationChange,
}: HeaderProps) {
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
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile sidebar trigger — uses shadcn SidebarTrigger */}
        <SidebarTrigger className="lg:hidden" />

        {/* Logo */}
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <Shield className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">InsurePortal</span>
        </Link>

        {/* Desktop nav — shadcn NavigationMenu */}
        <NavigationMenu className="hidden lg:flex" viewport={false}>
          <NavigationMenuList>
            {visibleItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink asChild active={isActive}>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "gap-1.5",
                        isActive && "bg-muted text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side: org switcher + avatar */}
        <div className="ml-auto flex items-center gap-3">
          {organizations &&
            organizations.length > 0 &&
            onOrganizationChange &&
            currentOrganization && (
              <div className="hidden sm:block">
                <OrgSwitcher
                  current={currentOrganization}
                  organizations={organizations}
                  onChange={onOrganizationChange}
                />
              </div>
            )}

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-border">
                  {initials}
                </div>
              )}
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={ROUTES.SETTINGS} className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={ROUTES.LOGOUT}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
