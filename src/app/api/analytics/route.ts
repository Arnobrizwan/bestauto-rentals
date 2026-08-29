import { guard, ok } from "@/lib/security/http";
import {
  getBestSellers,
  getFleetUtilisation,
  getKpis,
  getRecentBookings,
  getSalesByCountry,
  getSalesSeries,
  getSourceMix,
  getStatusMix,
  resolveRange,
  type Grain,
} from "@/server/repositories/analytics";

export const dynamic = "force-dynamic";

/**
 * One call powers the whole dashboard. Every figure is a SQL aggregate over the
 * bookings table — there are no stored rollups to drift out of date.
 */
export async function GET(req: Request) {
  const blocked = await guard(req, "analytics", 120);
  if (blocked) return blocked;

  const params = new URL(req.url).searchParams;
  const range = resolveRange(params.get("preset"), params.get("from"), params.get("to"));
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  const grain: Grain = (params.get("grain") as Grain) ?? (spanDays > 120 ? "month" : spanDays > 31 ? "week" : "day");

  const [kpis, series, countries, bestSellers, recent, utilisation, statusMix, sourceMix] = await Promise.all([
    getKpis(range),
    getSalesSeries(range, grain),
    getSalesByCountry(range),
    getBestSellers(range),
    getRecentBookings(5),
    getFleetUtilisation(range),
    getStatusMix(range),
    getSourceMix(range),
  ]);

  return ok({
    range: { from: range.from.toISOString(), to: range.to.toISOString(), grain, days: spanDays },
    kpis,
    series,
    countries,
    bestSellers,
    recent,
    utilisation,
    statusMix,
    sourceMix,
  });
}
