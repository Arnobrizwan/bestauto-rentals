import { z } from "zod";

import { hashPassword } from "@/lib/auth/password";
import { getSessionClaims, requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, guard, ok, readJson, sanitizeText } from "@/lib/security/http";
import {
  createTeamMember,
  findAdminByEmail,
  listAdmins,
  setAdminActive,
} from "@/server/repositories/admin-users";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(12).max(200),
  role: z.enum(["admin", "viewer"]),
});

const patchSchema = z.object({ id: z.string().min(3).max(64), active: z.boolean() });

/** The staff list. Never returns a password hash. */
export async function GET() {
  const blocked = await requireAdmin();
  if (blocked) return blocked;
  return ok({ members: await listAdmins() });
}

/**
 * Creates a further staff account.
 *
 * This is the counterpart to `/api/auth/setup` closing permanently: once the
 * first administrator exists, every later account comes from here, which
 * requires an existing admin session rather than being publicly reachable.
 */
export async function POST(req: Request) {
  const blocked = await requireAdmin({ role: "admin" });
  if (blocked) return blocked;

  const limited = guard(req, "team-create", 10, 15 * 60_000);
  if (limited) return limited;

  const body = await readJson(req, createSchema, 4_000);
  if (!body.ok) return body.response;

  if (await findAdminByEmail(body.data.email)) {
    return fail(409, "An account with that email already exists.");
  }

  const member = await createTeamMember({
    name: sanitizeText(body.data.name, 120),
    email: body.data.email,
    passwordHash: await hashPassword(body.data.password),
    role: body.data.role,
  });

  log.info("team.member_created", { userId: member.id, role: member.role });
  return ok({ member });
}

/** Activates or deactivates an account. An admin cannot lock themselves out. */
export async function PATCH(req: Request) {
  const blocked = await requireAdmin({ role: "admin" });
  if (blocked) return blocked;

  const body = await readJson(req, patchSchema, 2_000);
  if (!body.ok) return body.response;

  const claims = await getSessionClaims();
  if (claims?.sub === body.data.id && !body.data.active) {
    return fail(400, "You cannot deactivate your own account.");
  }

  const row = await setAdminActive(body.data.id, body.data.active);
  if (!row) return fail(404, "No such account.");

  log.info("team.member_updated", { userId: row.id, active: row.active });
  return ok({ member: row });
}
