import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok, readJson, sanitizeText } from "@/lib/security/http";
import { countAdmins, createAdmin } from "@/server/repositories/admin-users";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(12).max(200),
});

/**
 * One-time admin setup.
 *
 * Creates the very first administrator and signs them straight in. It is only
 * reachable while the admin table is empty — once an account exists this
 * returns 409 forever, so it cannot be used to mint a second admin. Further
 * accounts are created by an existing admin, not through a public endpoint.
 */
export async function POST(req: Request) {
  const blocked = await guard(req, "auth-setup", 5, 15 * 60_000);
  if (blocked) return blocked;

  if ((await countAdmins()) > 0) {
    return fail(409, "An administrator already exists. Ask them to create your account.");
  }

  const body = await readJson(req, schema, 4_000);
  if (!body.ok) return body.response;

  // Re-check immediately before writing to narrow the race between two setup
  // requests arriving together; the unique index on email is the real backstop.
  if ((await countAdmins()) > 0) {
    return fail(409, "An administrator already exists.");
  }

  const user = await createAdmin({
    name: sanitizeText(body.data.name, 120),
    email: body.data.email,
    passwordHash: await hashPassword(body.data.password),
  });

  log.info("auth.setup_completed", { userId: user.id });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: "admin",
      ver: 1,
  });

  const response = ok({ ok: true, next: "/admin" }, { status: 201 });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_SECONDS));
  return response;
}
