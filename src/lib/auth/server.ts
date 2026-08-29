import { cookies } from "next/headers";

import { fail } from "@/lib/security/http";
import { findAdminById } from "@/server/repositories/admin-users";

import { SESSION_COOKIE, readSessionToken, type SessionClaims } from "./session";

/** Reads and verifies the session cookie. Signature only — no database hit. */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Full check for server components: verifies the cookie *and* confirms the
 * account still exists and is active, so revoking access does not have to wait
 * for the cookie to expire.
 */
export async function getCurrentAdmin() {
  const claims = await getSessionClaims();
  if (!claims) return null;

  const user = await findAdminById(claims.sub);
  if (!user || !user.active) return null;

  // A token minted before the account's version was bumped is dead, which is
  // how "sign out everywhere" and a password change take effect immediately
  // rather than waiting out the cookie's eight hours.
  if ((claims.ver ?? 0) !== user.sessionVersion) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role as SessionClaims["role"] };
}

/**
 * Guard for route handlers. Returns a 401/403 response to return early with,
 * or null when the caller is allowed through.
 *
 * This loads the account rather than trusting the cookie's claims. Checking
 * the signature alone meant a deactivated or deleted administrator kept full
 * write access to every API route until the cookie expired eight hours later
 * — while the pages, which use `getCurrentAdmin`, locked them out on the next
 * navigation. The role is read from the row too, so demoting an admin to
 * viewer takes effect immediately instead of at their next sign-in.
 */
export async function requireAdmin(options: { role?: "admin" } = {}) {
  const user = await getCurrentAdmin();
  if (!user) return fail(401, "Authentication required.");
  if (options.role === "admin" && user.role !== "admin") {
    return fail(403, "This action requires an admin account.");
  }
  return null;
}
