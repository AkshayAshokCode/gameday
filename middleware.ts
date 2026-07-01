import { NextRequest, NextResponse } from "next/server";

// Routes accessible without a session
const PUBLIC_PATHS = ["/login", "/verify", "/invite"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // The Supabase JWT is stored client-side in localStorage (not cookies), so we
  // can't gate routes server-side without hydration. Use a lightweight check:
  // if the request has a cookie we set on the client after a successful exchange,
  // allow through; otherwise redirect to /login.
  // The cookie is set in the client exchange handler below.
  const session = req.cookies.get("gd_session");
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files.
     * Equivalent to: everything that isn't /_next/static, /_next/image, or image files.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
