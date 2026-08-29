import { emit } from "@/automation/engine";
import { formatCurrency } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/server";
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

/**
 * The "run it now" button on the Automations page.
 *
 * The edge gate only proves a session exists, not what it may do, and firing
 * the digest writes automation runs and queues outbound messages. That is a
 * mutation, so it takes the admin role like every other one — a viewer signing
 * in to look around cannot set the workflow engine running.
 */
export async function POST(req: Request) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const blocked = await guard(req, "cron-manual", 10);
  if (blocked) return blocked;
  return run();
}
