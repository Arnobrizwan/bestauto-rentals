import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentAdmin } from "@/lib/auth/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok, readJson } from "@/lib/security/http";
import { bumpSessionVersion, findAdminById, updatePassword } from "@/server/repositories/admin-users";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

/**
 * Changes the signed-in account's own password.
 *
 * Requires the current password, so a borrowed session cannot lock the owner
 * out of their own account. Changing it invalidates every session already
 * issued — including any an attacker holds — and the caller is immediately
 * re-issued a fresh cookie so they are not signed out of the tab they are
 * standing in.
 */
export async function POST(req: Request) {
  const me = await getCurrentAdmin();
  if (!me) return fail(401, "Authentication required.");

  const limited = guard(req, "password-change", 5, 15 * 60_000);
  if (limited) return limited;

  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;

  const account = await findAdminById(me.id);
  if (!account) return fail(401, "Authentication required.");

  if (!(await verifyPassword(body.data.currentPassword, account.passwordHash))) {
    return fail(403, "That is not the current password.");
  }
  if (body.data.currentPassword === body.data.newPassword) {
    return fail(422, "The new password has to be different.");
  }

  const updated = await updatePassword(account.id, await hashPassword(body.data.newPassword));
  if (!updated) return fail(500, "Could not change the password.");

  const token = await createSessionToken({
    sub: account.id,
    email: account.email,
    name: account.name,
    role: account.role as "admin" | "viewer",
    ver: updated.version,
  });

  log.info("auth.password_changed", { userId: account.id });

  const response = ok({ ok: true, signedOutOtherDevices: true });
  response.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions(), maxAge: SESSION_TTL_SECONDS });
  return response;
}

/**
 * Signs the account out everywhere, this device included.
 *
 * The cookie is stateless, so there is nothing to delete on other devices —
 * bumping the account's session version is what makes every token already
 * issued stop verifying.
 */
export async function DELETE() {
  const me = await getCurrentAdmin();
  if (!me) return fail(401, "Authentication required.");

  const version = await bumpSessionVersion(me.id);
  log.info("auth.sessions_revoked", { userId: me.id, version });

  const response = ok({ ok: true, revoked: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
