import { guard, ok } from "@/lib/security/http";
import { automationStats, listEvents, listOutbox, listRules, listRuns } from "@/server/repositories/automation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = await guard(req, "automations", 90);
  if (blocked) return blocked;

  const [rules, runs, events, outbox, stats] = await Promise.all([
    listRules(),
    listRuns(20),
    listEvents(20),
    listOutbox(20),
    automationStats(),
  ]);

  return ok({ rules, runs, events, outbox, stats });
}
