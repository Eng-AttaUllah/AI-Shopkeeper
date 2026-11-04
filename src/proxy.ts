import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Next.js 16 calls this file `proxy.ts`; it replaces `middleware.ts`.
 *
 * This is an optimistic gate only. Every server action re-checks the session
 * with `requireUser()` before changing data.
 *
 * Role-based routing:
 * - CUSTOMER users can only access /customers/khata (and login/sign-up).
 * - OWNER/CASHIER users cannot access /customers/khata.
 */
export default auth((request) => {
  const { nextUrl } = request;
  const isLoginPage = nextUrl.pathname === "/login";
  const isSignUpPage = nextUrl.pathname === "/customers/sign-up";
  const isKhataPage = nextUrl.pathname === "/customers/khata";
  const isSignedIn = Boolean(request.auth);
  const user = request.auth?.user;
  const isCustomer = user?.role === "CUSTOMER";

  if (isLoginPage || isSignUpPage) {
    if (isSignedIn) {
      if (isCustomer) {
        return NextResponse.redirect(new URL("/customers/khata", nextUrl));
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isSignedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("from", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing
  if (isCustomer && !isKhataPage) {
    return NextResponse.redirect(new URL("/customers/khata", nextUrl));
  }

  if (!isCustomer && isKhataPage) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protect pages and server actions; leave the Auth.js endpoints, the
    // token-authenticated camera intake, and static assets reachable while
    // signed out. Both /api/camera routes enforce access themselves.
    "/((?!api/auth|api/camera|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
