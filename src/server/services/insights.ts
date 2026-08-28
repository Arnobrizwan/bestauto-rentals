import type { OpsSnapshot } from "@/ai/agents/ops-analyst";
import {
  getBestSellers,
  getFleetUtilisation,
  getKpis,
  getSalesByCountry,
  getSourceMix,
  getStatusMix,
  type Range,
} from "@/server/repositories/analytics";

/**
 * Assembles the metric snapshot the operations analyst reasons over.
 * Shared by the API route and the server-rendered dashboard so both see
 * identical numbers.
 */
export async function buildOpsSnapshot(range: Range): Promise<OpsSnapshot> {
  const [kpis, bestSellers, utilisation, statusMix, countries, sourceMix] = await Promise.all([
    getKpis(range),
    getBestSellers(range, 1),
    getFleetUtilisation(range),
    getStatusMix(range),
    getSalesByCountry(range),
    getSourceMix(range),
  ]);

  const totalStatus = statusMix.reduce((sum, s) => sum + s.n, 0);
  const cancelled = statusMix.find((s) => s.status === "cancelled")?.n ?? 0;
  const byUtilisation = [...utilisation].sort((a, b) => a.utilisation - b.utilisation);
  const weakest = byUtilisation[0];
  const strongest = byUtilisation.at(-1);

  return {
    revenue: kpis.revenue.value,
    revenueDelta: kpis.revenue.delta,
    bookings: kpis.bookings.value,
    bookingsDelta: kpis.bookings.delta,
    conversion: kpis.conversion.value,
    averageOrder: kpis.averageOrder.value,
    cancelledShare: totalStatus ? (cancelled / totalStatus) * 100 : 0,
    topVehicle: bestSellers[0] ? { name: bestSellers[0].name, sales: bestSellers[0].sales } : null,
    weakestSegment: weakest ? { segment: weakest.segment, utilisation: weakest.utilisation } : null,
    bestSegment: strongest ? { segment: strongest.segment, utilisation: strongest.utilisation } : null,
    topCountry: countries[0] ? { country: countries[0].country, sales: countries[0].sales } : null,
    hotLeads: kpis.leads.hot,
    totalLeads: kpis.leads.value,
    aiSourcedBookings: sourceMix.find((s) => s.source === "ai-concierge")?.n ?? 0,
  };
}
