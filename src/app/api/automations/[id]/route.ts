import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { fail, guard, ok, readJson } from "@/lib/security/http";
import { setRuleEnabled } from "@/server/repositories/automation";

export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorised = await requireAdmin({ role: "admin" });
  if (unauthorised) return unauthorised;

  const blocked = await guard(req, "automations-patch", 40);
  if (blocked) return blocked;

  const body = await readJson(req, schema);
  if (!body.ok) return body.response;

  const { id } = await params;
  const rule = await setRuleEnabled(id, body.data.enabled);
  if (!rule) return fail(404, "Rule not found.");
  return ok({ id: rule.id, enabled: rule.enabled });
}
