import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { fail, guard, ok, readJson } from "@/lib/security/http";
import { listLeads, updateLeadStatus } from "@/server/repositories/leads";
import { createLead } from "@/server/services/leads";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  message: z.string().min(4).max(2000),
  intent: z.enum(["book", "enquiry", "corporate", "browse"]).optional(),
  budgetPerDay: z.number().min(0).max(100000).nullish(),
  timeframe: z.enum(["today", "this_week", "this_month", "next_month", "this_quarter", "unknown"]).optional(),
  partySize: z.number().int().min(1).max(20).nullish(),
  source: z.string().max(40).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1).max(60),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]),
});

export async function GET(req: Request) {
  const blocked = guard(req, "leads-list", 120);
  if (blocked) return blocked;
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return ok(
    await listLeads({
      tier: params.tier,
      status: params.status,
      q: params.q,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 10,
    }),
  );
}

export async function POST(req: Request) {
  const blocked = guard(req, "leads-create", 8);
  if (blocked) return blocked;

  const body = await readJson(req, createSchema);
  if (!body.ok) return body.response;

  const { lead, scored, automation } = await createLead({
    ...body.data,
    budgetPerDay: body.data.budgetPerDay ?? undefined,
    partySize: body.data.partySize ?? undefined,
  });

  return ok(
    {
      id: lead.id,
      score: scored.score,
      tier: scored.tier,
      summary: scored.summary,
      signals: scored.signals,
      nextAction: scored.nextAction,
      engine: scored.engine,
      latencyMs: scored.latencyMs,
      automation: automation.map((a) => ({ rule: a.ruleName, status: a.status, steps: a.steps })),
    },
    { status: 201 },
  );
}

export async function PATCH(req: Request) {
  const unauthorised = await requireAdmin({ role: "admin" });
  if (unauthorised) return unauthorised;

  const blocked = guard(req, "leads-patch", 60);
  if (blocked) return blocked;

  const body = await readJson(req, patchSchema);
  if (!body.ok) return body.response;

  const updated = await updateLeadStatus(body.data.id, body.data.status);
  if (!updated) return fail(404, "Lead not found.");
  return ok({ id: updated.id, status: updated.status });
}
