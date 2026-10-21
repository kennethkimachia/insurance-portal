"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
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
import { OrgSwitcher } from "@/components/navigation/org-switcher";
import { ModeToggle } from "@/components/mode-toggle";
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
  Bell,
  FilePlus2,
  CircleHelp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type UserRole = "admin" | "head_agent" | "agent" | "user";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
  secondary?: boolean;
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

// â”€â”€ Nav items by role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    roles: ["admin", "head_agent", "agent"],
  },
  {
    label: "Report an incident",
    href: ROUTES.CLAIM_FORMS,
    icon: FilePlus2,
    roles: ["admin", "head_agent", "agent", "user"],
    secondary: true,
  },
  {
    label: "Updates",
    href: "/notifications",
    icon: Bell,
    roles: ["admin", "head_agent", "agent", "user"],
    secondary: true,
  },
  {
    label: "Help",
    href: "/help",
    icon: CircleHelp,
    roles: ["admin", "head_agent", "agent", "user"],
    secondary: true,
  },
];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function Header({
  user,
  currentOrganization,
  organizations,
  onOrganizationChange,
}: HeaderProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes(user.role) && !item.secondary,
  );

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/95 shadow-[0_1px_8px_-4px_rgb(18_40_32/0.1)] backdrop-blur supports-backdrop-filter:bg-card/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile sidebar trigger â€” uses shadcn SidebarTrigger */}
        <SidebarTrigger className="xl:hidden" />

        {/* Logo */}
        <Link
          href={ROUTES.HOME}
          className="flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
        >
          <Shield className="size-9 rounded-xl bg-primary p-2 text-primary-foreground shadow-sm" />
          <span className="hidden sm:inline">InsurePortal</span>
        </Link>

        {/* Desktop nav â€” shadcn NavigationMenu */}
        <NavigationMenu className="hidden xl:flex" viewport={false}>
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
                        "gap-1.5 text-muted-foreground",
                        isActive && "bg-accent text-primary shadow-xs",
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
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {organizations &&
            organizations.length > 0 &&
            onOrganizationChange &&
            currentOrganization && (
              <div className="hidden md:block">
                <OrgSwitcher
                  current={currentOrganization}
                  organizations={organizations}
                  onChange={onOrganizationChange}
                />
              </div>
            )}

          <Link
            href="/claim-forms"
            title="Report an incident"
            aria-label="Report an incident"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FilePlus2 className="size-4" />
          </Link>
          <Link
            href="/notifications"
            title="Claim updates"
            aria-label="Claim updates"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="size-4" />
          </Link>
          <ModeToggle />

          {/* Avatar dropdown */}
          <Show when="signed-in"><UserButton /></Show>
          <Show when="signed-out">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex shrink-0 items-center gap-2 rounded-full p-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
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
                  <Link href="/help" className="cursor-pointer gap-2">
                    <CircleHelp className="h-4 w-4" />
                    Help and contact
                  </Link>
                </DropdownMenuItem>
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
          </Show>
        </div>
      </div>
    </header>
  );
}
