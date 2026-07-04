import { NextRequest, NextResponse } from "next/server";

// Routes accessible without a session. /api/invite is the public group
// preview a logged-out link recipient loads before signing in — the join
// endpoint under it still enforces auth itself via the Bearer token.
const PUBLIC_PATHS = ["/login", "/verify", "/invite", "/api/invite"];

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
    loginUrl.search = "";
    // Preserve where the user was headed (e.g. a session link shared in
    // WhatsApp) so login/verify can send them back instead of dropping them
    // on the home page.
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
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
