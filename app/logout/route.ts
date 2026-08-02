import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export async function GET(request: NextRequest) {
  const signOutResponse = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const response = NextResponse.redirect(
    new URL(ROUTES.SIGNIN, request.nextUrl),
  );

  // Preserve every cookie cleared by Better Auth on the redirect response.
  for (const cookie of signOutResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}