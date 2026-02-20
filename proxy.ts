import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {ROUTES} from "./lib/routes"

const PUBLIC_ROUTES = [ROUTES.SIGNIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD, ROUTES.RESET_PASSWORD, ROUTES.API_ROUTES];
const AUTH_ROUTES = [ROUTES.SIGNIN, ROUTES.SIGNUP];

const ROLE_DASHBOARD: Record<string, string> = {
  admin: ROUTES.DASHBOARD_ADMIN,
  headAgent: ROUTES.DASHBOARD_HEAD_AGENT,
  agent: ROUTES.DASHBOARD_AGENT,
  user: ROUTES.DASHBOARD_USER,
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(ROUTES.API_ROUTES)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const signInUrl = new URL(ROUTES.SIGNIN, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (sessionCookie && (AUTH_ROUTES.some((route) => pathname.startsWith(route)) || pathname === "/")) {
    const session = await auth.api.getSession({ headers: await headers() });
    const role = (session?.user as { role?: string })?.role ?? "user";
    const dashboard = ROLE_DASHBOARD[role] || ROLE_DASHBOARD.user;
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  if (sessionCookie && pathname.startsWith(ROUTES.DASHBOARD)) {
    const session = await auth.api.getSession({ headers: await headers() });
    const role = (session?.user as { role?: string })?.role ?? "user";
    if (role === "admin") {
      return NextResponse.next();
    }

    const allowedDashboard = ROLE_DASHBOARD[role] || ROLE_DASHBOARD.user;
    if (!pathname.startsWith(allowedDashboard)) {
      return NextResponse.redirect(new URL(allowedDashboard, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
