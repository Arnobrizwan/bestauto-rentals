import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";
import { BRANCH_COOKIE, branchForRequest } from "@/lib/geo";

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

/**
 * Records which branch to open the search on, from the request's own city.
 *
 * Vercel attaches `x-vercel-ip-city` and `x-vercel-ip-country` to every
 * request, so the nearest branch can be preselected with no permission prompt
 * and nothing for the visitor to do. It is written to a cookie rather than
 * read in the page because the home page is prerendered with `revalidate`, and
 * reading a header there would make every visitor wait for a render that used
 * to come from the edge.
 *
 * Not httpOnly: the search panel reads it in the browser. It holds a branch
 * name — the same list already in the page's markup — and nothing else.
 */
function rememberBranch(request: NextRequest, response: NextResponse) {
  const branch = branchForRequest(
    request.headers.get("x-vercel-ip-city"),
    request.headers.get("x-vercel-ip-country"),
  );
  response.cookies.set(BRANCH_COOKIE, branch, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!needsSession(pathname, request.method)) return rememberBranch(request, NextResponse.next());

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
  // The customer-facing pages are matched too, so the branch cookie is set on
  // the first request rather than only once someone reaches an admin route.
  // They cost one header read and pass straight through the session check.
  matcher: ["/", "/cars/:path*", "/booking/:path*", "/admin/:path*", "/api/:path*"],
};
