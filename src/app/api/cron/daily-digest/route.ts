import { emit } from "@/automation/engine";
import { formatCurrency } from "@/lib/utils";
import { guard, ok, requireCronAuth } from "@/lib/security/http";
import { getKpis, resolveRange } from "@/server/repositories/analytics";

export const dynamic = "force-dynamic";

/**
 * Scheduled job. Wired to Vercel Cron in vercel.json; also callable manually
 * from the admin Automations page so the workflow can be demonstrated live.
 */
async function run() {
  const range = resolveRange("7d");
  const kpis = await getKpis(range);

  const outcomes = await emit("schedule.daily", {
    metrics: {
      revenue: formatCurrency(kpis.revenue.value),
      bookings: kpis.bookings.value,
      hotLeads: kpis.leads.hot,
      conversion: `${kpis.conversion.value.toFixed(1)}%`,
    },
  });

  return ok({
    ran: true,
    at: new Date().toISOString(),
    triggered: outcomes.map((o) => ({ rule: o.ruleName, status: o.status, steps: o.steps })),
  });
}

export async function GET(req: Request) {
  const unauthorised = requireCronAuth(req);
  if (unauthorised) return unauthorised;
  return run();
}

export async function POST(req: Request) {
  const blocked = guard(req, "cron-manual", 10);
  if (blocked) return blocked;
  return run();
}
