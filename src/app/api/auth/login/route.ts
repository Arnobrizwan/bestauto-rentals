import { z } from "zod";

import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok, readJson } from "@/lib/security/http";
import { findAdminByEmail, touchLastLogin } from "@/server/repositories/admin-users";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  // Deliberately tight: five attempts per quarter hour per client.
  const blocked = guard(req, "auth-login", 5, 15 * 60_000);
  if (blocked) return blocked;

  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;

  const user = await findAdminByEmail(body.data.email);

  // Always run a verification so a missing account and a wrong password take
  // the same time and return the same message - no account enumeration.
  const stored = user?.passwordHash ?? "pbkdf2-sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const valid = await verifyPassword(body.data.password, stored);

  if (!user || !user.active || !valid) {
    log.warn("auth.login_failed", { email: body.data.email });
    return fail(401, "That email and password combination is not recognised.");
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "viewer" ? "viewer" : "admin",
      ver: user.sessionVersion,
  });

  await touchLastLogin(user.id);
  log.info("auth.login", { userId: user.id, role: user.role });

  const response = ok({
    ok: true,
    user: { name: user.name, email: user.email, role: user.role },
    // Only ever redirect within this app.
    next: body.data.next?.startsWith("/") && !body.data.next.startsWith("//") ? body.data.next : "/admin",
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SECONDS));
  return response;
}
