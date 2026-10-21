import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { safeAuthContinuation } from "./lib/auth-navigation";

// Establish Clerk's auth context. Protected layouts, server actions and API
// handlers enforce access where data is read or changed, independently of URLs.
export default clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;
  const continuation = safeAuthContinuation(path + request.nextUrl.search);
  // These redirects improve navigation only; resource checks remain authoritative.
  const protectedRoots = ["/dashboard", "/claims", "/claim-forms", "/policies", "/settings", "/customers", "/agents", "/organizations", "/notifications"];
  if (protectedRoots.some((root) => path === root || path.startsWith(`${root}/`)) && !(await auth()).userId) {
    const target = new URL("/sign-in", request.url);
    target.searchParams.set("next", continuation);
    return NextResponse.redirect(target);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-portal-auth-continuation", continuation);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
