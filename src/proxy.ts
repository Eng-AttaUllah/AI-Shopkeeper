import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Next.js 16 calls this file `proxy.ts`; it replaces `middleware.ts`.
 *
 * This is an optimistic gate only. Every server action re-checks the session
 * with `requireUser()` before changing data.
 */
export default auth((request) => {
  const { nextUrl } = request;
  const isLoginPage = nextUrl.pathname === "/login";
  const isSignedIn = Boolean(request.auth);

  if (isLoginPage) {
    if (isSignedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    return NextResponse.next();
  }

  if (!isSignedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", `${nextUrl.pathname}${nextUrl.search}`);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protect pages and server actions; leave the Auth.js endpoints and
    // static assets reachable while signed out.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
