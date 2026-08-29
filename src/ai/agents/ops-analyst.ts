import { z } from "zod";

import { describeEngine, resolveProviderForRequest, type EngineInfo } from "@/ai/provider";
import { OPS_ANALYST_SYSTEM_V1 } from "@/ai/prompts";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { stripFences } from "./recommender";
import { normaliseMetric } from "@/ai/validation";

export type Insight = {
  title: string;
  detail: string;
  severity: "positive" | "neutral" | "warning";
  metric: string;
};

export type OpsSnapshot = {
  revenue: number;
  revenueDelta: number;
  bookings: number;
  bookingsDelta: number;
  conversion: number;
  averageOrder: number;
  cancelledShare: number;
  topVehicle: { name: string; sales: number } | null;
  weakestSegment: { segment: string; utilisation: number } | null;
  bestSegment: { segment: string; utilisation: number } | null;
  topCountry: { country: string; sales: number } | null;
  hotLeads: number;
  totalLeads: number;
  aiSourcedBookings: number;
};

export type InsightResult = { insights: Insight[]; engine: EngineInfo; latencyMs: number; degraded?: string };

/** Threshold-driven analyst. Every line has to cite a real figure to be emitted. */
export function rulesInsights(s: OpsSnapshot): Insight[] {
  const out: Insight[] = [];

  if (Math.abs(s.revenueDelta) >= 4) {
    const up = s.revenueDelta > 0;
    out.push({
      title: up ? "Revenue is running ahead" : "Revenue is slipping",
      detail: up
        ? `Revenue of ${formatCurrency(s.revenue)} is ${s.revenueDelta.toFixed(1)}% above the previous period. Hold pricing rather than discounting while demand carries it.`
        : `Revenue of ${formatCurrency(s.revenue)} is ${Math.abs(s.revenueDelta).toFixed(1)}% below the previous period. Check whether it is fewer bookings or a softer average order before reacting.`,
      severity: up ? "positive" : "warning",
      metric: `${s.revenueDelta > 0 ? "+" : ""}${s.revenueDelta.toFixed(1)}% revenue`,
    });
  }

  if (s.cancelledShare >= 8) {
    out.push({
      title: "Cancellations above tolerance",
      detail: `${s.cancelledShare.toFixed(1)}% of bookings in this window cancelled. At this rate the free-cancellation window is worth reviewing, or deposits should be taken earlier.`,
      severity: "warning",
      metric: `${s.cancelledShare.toFixed(1)}% cancelled`,
    });
  }

  if (s.weakestSegment && s.weakestSegment.utilisation < 35) {
    out.push({
      title: "Idle capacity in the fleet",
      detail: `The ${s.weakestSegment.segment} segment is running at ${s.weakestSegment.utilisation.toFixed(0)}% utilisation. Either move units to a busier branch or put a short promotion behind it.`,
      severity: "warning",
      metric: `${s.weakestSegment.utilisation.toFixed(0)}% utilisation`,
    });
  }

  if (s.bestSegment && s.bestSegment.utilisation > 60) {
    out.push({
      title: "Demand outstripping supply",
      detail: `The ${s.bestSegment.segment} segment is at ${s.bestSegment.utilisation.toFixed(0)}% utilisation. That is the segment to add units to, and the one where a price rise would stick.`,
      severity: "positive",
      metric: `${s.bestSegment.utilisation.toFixed(0)}% utilisation`,
    });
  }

  if (s.topVehicle) {
    out.push({
      title: "Single vehicle carrying demand",
      detail: `The ${s.topVehicle.name} took ${formatNumber(s.topVehicle.sales)} bookings this period — the fleet's clearest repeat performer. Worth checking it is never the constraint on a busy weekend.`,
      severity: "neutral",
      metric: `${s.topVehicle.sales} bookings`,
    });
  }

  if (s.totalLeads > 0 && s.hotLeads / s.totalLeads >= 0.25) {
    out.push({
      title: "Hot leads are backing up",
      detail: `${s.hotLeads} of ${s.totalLeads} leads scored hot. These decay fast — anything not called within a day is effectively a cold lead.`,
      severity: "warning",
      metric: `${s.hotLeads} hot leads`,
    });
  }

  if (s.aiSourcedBookings > 0) {
    out.push({
      title: "Concierge is converting",
      detail: `${formatNumber(s.aiSourcedBookings)} bookings this period came through the AI concierge. That channel is now worth measuring against paid acquisition.`,
      severity: "positive",
      metric: `${s.aiSourcedBookings} AI-sourced`,
    });
  }

  if (s.conversion < 70 && s.conversion > 0) {
    out.push({
      title: "Conversion has room",
      detail: `${s.conversion.toFixed(1)}% of bookings reach success. The gap is pending and cancelled orders — chasing pending payments is the fastest recovery.`,
      severity: "neutral",
      metric: `${s.conversion.toFixed(1)}% conversion`,
    });
  }

  if (s.topCountry) {
    out.push({
      title: "Demand concentration",
      detail: `${s.topCountry.country} accounts for ${formatNumber(s.topCountry.sales)} bookings, the largest single market. Worth a localised landing page before spending more on ads elsewhere.`,
      severity: "neutral",
      metric: `${s.topCountry.sales} bookings`,
    });
  }

  const rank = { warning: 0, positive: 1, neutral: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 4);
}

/**
 * What the model is allowed to return.
 *
 * `metric` is deliberately just a bounded string: the prompt asks for a
 * unit-bearing display value, but a model that returns a bare number still
 * parses here and is repaired by `normaliseMetric` rather than rejected —
 * rejecting it would throw away three good insights over one ugly chip.
 */
const insightSchema = z.object({
  title: z.string().min(1).max(48),
  detail: z.string().min(1).max(240),
  severity: z.enum(["positive", "neutral", "warning"]),
  metric: z.union([z.string(), z.number()]),
});

const insightsResponseSchema = z.object({
  insights: z.array(insightSchema).min(1),
});

export async function generateInsights(snapshot: OpsSnapshot): Promise<InsightResult> {
  const started = Date.now();
  const baseline = rulesInsights(snapshot);
  const provider = await resolveProviderForRequest();

  if (!provider) return { insights: baseline, engine: describeEngine(null), latencyMs: Date.now() - started };

  try {
    const res = await provider.complete({
      system: OPS_ANALYST_SYSTEM_V1,
      json: true,
      maxTokens: 700,
      temperature: 0.2,
      messages: [{ role: "user", content: `Metrics:\n${JSON.stringify(snapshot, null, 1)}` }],
    });
    // safeParse, not a cast: a cast asserts the shape, it does not check it.
    // A failure throws into the catch below, which is the same path a vendor
    // outage takes — the rules-engine baseline is served and `degraded` says
    // why, so a malformed response degrades rather than reaching the page.
    const parsed = insightsResponseSchema.safeParse(JSON.parse(stripFences(res.text)));
    if (!parsed.success) {
      throw new Error(`Model response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }

    const insights: Insight[] = parsed.data.insights.slice(0, 4).map((insight) => ({
      title: insight.title,
      detail: insight.detail,
      severity: insight.severity,
      // The chip the dashboard renders. Everything the model sent passes
      // through here, so a raw float becomes "+53.6% revenue" instead of
      // "53.6015004126".
      metric: normaliseMetric(insight.metric, `${insight.title} ${insight.detail}`),
    }));

    return {
      insights,
      engine: describeEngine(provider),
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      insights: baseline,
      engine: describeEngine(null),
      latencyMs: Date.now() - started,
      degraded: err instanceof Error ? err.message : "Model call failed; served rules engine.",
    };
  }
}
