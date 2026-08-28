import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { ok } from "@/lib/security/http";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = ok({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
