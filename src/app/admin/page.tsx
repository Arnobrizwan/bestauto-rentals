import type { Metadata } from "next";

import { generateInsights } from "@/ai/agents/ops-analyst";
import { Dashboard, type Analytics } from "@/components/admin/dashboard";
import { buildOpsSnapshot } from "@/server/services/insights";
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
} from "@/server/repositories/analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard is server-rendered with a first payload so it is useful before
 * any JavaScript runs; the client component then owns the range filter and
 * re-fetches through the same API the rest of the product uses.
 */
export default async function AdminDashboardPage() {
  const range = resolveRange("30d");
  const spanDays = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  const grain = spanDays > 120 ? "month" : spanDays > 31 ? "week" : "day";

  const [kpis, series, countries, bestSellers, recent, utilisation, statusMix, sourceMix, insights] = await Promise.all([
    getKpis(range),
    getSalesSeries(range, grain),
    getSalesByCountry(range),
    getBestSellers(range),
    getRecentBookings(5),
    getFleetUtilisation(range),
    getStatusMix(range),
    getSourceMix(range),
    buildOpsSnapshot(range).then(generateInsights),
  ]);

  const initial: Analytics = {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), grain, days: spanDays },
    kpis,
    series,
    countries,
    bestSellers,
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    utilisation,
    statusMix,
    sourceMix,
  };

  return <Dashboard initial={initial} initialInsights={insights} />;
}
