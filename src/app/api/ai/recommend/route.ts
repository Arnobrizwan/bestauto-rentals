import { z } from "zod";

import { recommendVehicles } from "@/ai/agents/recommender";
import { guard, ok, readJson, sanitizeText } from "@/lib/security/http";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const schema = z.object({
  brief: z.string().max(600).optional(),
  passengers: z.number().int().min(1).max(9).optional(),
  budgetPerDay: z.number().min(0).max(10000).optional(),
  days: z.number().int().min(1).max(90).optional(),
  occasion: z.enum(["family", "business", "leisure", "special", "city", "unknown"]).optional(),
  transmission: z.enum(["Automatic", "Manual"]).optional(),
  fuel: z.enum(["Petrol", "Diesel", "Hybrid", "Electric"]).optional(),
  luggage: z.number().int().min(0).max(8).optional(),
  location: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const blocked = guard(req, "ai-recommend", 30);
  if (blocked) return blocked;

  const body = await readJson(req, schema);
  if (!body.ok) return body.response;

  const result = await recommendVehicles({
    ...body.data,
    brief: body.data.brief ? sanitizeText(body.data.brief, 600) : undefined,
  });

  return ok(result);
}
