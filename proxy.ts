import { NextRequest, NextResponse } from "next/server";

import { ROUTES } from "./lib/routes";

const PUBLIC_ROUTES = [
  ROUTES.SIGNIN,
  ROUTES.SIGNUP,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.API_ROUTES,
  "api/auth/[...all]",
];
const AUTH_ROUTES = [ROUTES.SIGNIN, ROUTES.SIGNUP];

const ROLE_DASHBOARD: Record<string, string> = {
  admin: ROUTES.DASHBOARD_ADMIN,
  headAgent: ROUTES.DASHBOARD_HEAD_AGENT,
  agent: ROUTES.DASHBOARD_AGENT,
  user: ROUTES.DASHBOARD_USER,
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(ROUTES.API_ROUTES) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  if (!sessionCookie && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // If they access the root without a session, just redirect to sign-in directly.
    if (pathname === "/") {
      return NextResponse.redirect(new URL(ROUTES.SIGNIN, request.url));
    }
    const signInUrl = new URL(ROUTES.SIGNIN, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (sessionCookie && (AUTH_ROUTES.some((route) => pathname.startsWith(route)) || pathname === "/")) {
    let sessionData = null;
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/auth/get-session`, {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });
      if (response.ok) sessionData = await response.json();
    } catch (e) {
      console.error("Failed to fetch session", e);
    }

    if (!sessionData || !sessionData.user) {
      const res = NextResponse.redirect(new URL(ROUTES.SIGNIN, request.url));
      res.cookies.delete("better-auth.session_token");
      res.cookies.delete("__Secure-better-auth.session_token");
      return res;
    }

    const role = sessionData.user.role || "user";
    const dashboard = ROLE_DASHBOARD[role] || ROLE_DASHBOARD.user;
    return NextResponse.redirect(new URL(dashboard, request.url));
  }

  if (sessionCookie && pathname.startsWith(ROUTES.DASHBOARD)) {
    let sessionData = null;
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/auth/get-session`, {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });
      if (response.ok) sessionData = await response.json();
    } catch (e) {
      console.error("Failed to fetch session", e);
    }

    if (!sessionData || !sessionData.user) {
      const res = NextResponse.redirect(new URL(ROUTES.SIGNIN, request.url));
      res.cookies.delete("better-auth.session_token");
      res.cookies.delete("__Secure-better-auth.session_token");
      return res;
    }

    const role = sessionData.user.role || "user";
    if (role === "admin") {
      if (pathname === ROUTES.DASHBOARD) {
        return NextResponse.redirect(new URL(ROUTES.DASHBOARD_ADMIN, request.url));
      }
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
