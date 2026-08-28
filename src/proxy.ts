import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

/**
 * Edge gate for everything under /admin and the admin-only API surface.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; this is the same
 * request-interception hook under the new name.
 *
 * It only verifies the cookie signature and expiry — it never touches the
 * database, so it stays fast on every navigation. The admin layout does the
 * authoritative "does this account still exist and is it active" check.
 */

/** Routes that require a session for every method. */
const PROTECTED_PREFIXES = [
  "/admin",
  "/api/analytics",
  "/api/automations",
  "/api/ai/insights",
  "/api/ai/qualify",
];

/**
 * Routes where only some methods are admin-only. The public site legitimately
 * POSTs a lead (contact form, concierge) and POSTs a booking, but only the
 * dashboard may read or mutate the collections.
 */
const METHOD_PROTECTED: { path: string; methods: string[] }[] = [
  { path: "/api/leads", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/bookings", methods: ["GET"] },
  // GET is the Vercel Cron entry point and authenticates with CRON_SECRET in
  // the handler; POST is the "run it now" button in the admin UI.
  { path: "/api/cron/daily-digest", methods: ["POST"] },
];

function needsSession(pathname: string, method: string) {
  if (PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return METHOD_PROTECTED.some((rule) => rule.path === pathname && rule.methods.includes(method));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!needsSession(pathname, request.method)) return NextResponse.next();

  const claims = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (claims) return NextResponse.next();

  // APIs get a JSON 401; humans get sent to the login page with a return path.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
