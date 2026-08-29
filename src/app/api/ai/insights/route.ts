import { generateInsights } from "@/ai/agents/ops-analyst";
import { guard, ok } from "@/lib/security/http";
import { resolveRange } from "@/server/repositories/analytics";
import { buildOpsSnapshot } from "@/server/services/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET(req: Request) {
  const blocked = await guard(req, "ai-insights", 30);
  if (blocked) return blocked;

  const params = new URL(req.url).searchParams;
  const range = resolveRange(params.get("preset"), params.get("from"), params.get("to"));
  const snapshot = await buildOpsSnapshot(range);
  const result = await generateInsights(snapshot);

  return ok({ ...result, snapshot });
}
