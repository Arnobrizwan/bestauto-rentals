import { z } from "zod";

import { qualifyLead } from "@/ai/agents/lead-qualifier";
import { guard, ok, readJson, sanitizeText } from "@/lib/security/http";

export const dynamic = "force-dynamic";

/**
 * Scores a lead without persisting it — used by the admin "score this" sandbox
 * so an operator can see how the model reacts before wiring a new channel in.
 */
const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  message: z.string().min(1).max(2000),
  intent: z.enum(["book", "enquiry", "corporate", "browse"]).optional(),
  budgetPerDay: z.number().nullish(),
  timeframe: z.enum(["today", "this_week", "this_month", "next_month", "this_quarter", "unknown"]).optional(),
  partySize: z.number().int().nullish(),
});

export async function POST(req: Request) {
  const blocked = await guard(req, "ai-qualify", 40);
  if (blocked) return blocked;

  const body = await readJson(req, schema);
  if (!body.ok) return body.response;

  return ok(await qualifyLead({ ...body.data, message: sanitizeText(body.data.message, 2000) }));
}
