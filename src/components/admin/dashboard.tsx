"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

import { SalesAreaChart, type SalesPoint } from "@/components/charts/sales-area";
import { SourceBars, StatusDonut, UtilisationBars } from "@/components/charts/mini";
import { WorldSalesMap, type CountrySales } from "@/components/charts/world-map";
import { Badge, Card, CardHeader, Delta, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import { cn, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

import { RangeFilter, type RangeState } from "./range-filter";

type Kpi = { value: number; delta: number };

type Analytics = {
  range: { from: string; to: string; grain: string; days: number };
  kpis: {
    revenue: Kpi;
    margin: Kpi;
    bookings: Kpi;
    rentalDays: Kpi;
    customers: Kpi;
    conversion: Kpi;
    averageOrder: Kpi;
    leads: { value: number; hot: number };
  };
  series: SalesPoint[];
  countries: CountrySales[];
  bestSellers: { id: string; name: string; slug: string; imageUrl: string; pricePerDay: number; sales: number; revenue: number }[];
  recent: {
    id: string;
    reference: string;
    status: string;
    total: number;
    paymentMethod: string;
    createdAt: string;
    vehicleName: string;
    vehicleImage: string;
    customerName: string;
  }[];
  utilisation: { segment: string; utilisation: number; rentalDays: number; revenue: number; units: number }[];
  statusMix: { status: string; n: number }[];
  sourceMix: { source: string; n: number; revenue: number }[];
};

type Insights = {
  insights: { title: string; detail: string; severity: "positive" | "neutral" | "warning"; metric: string }[];
  engine: { engine: string; model: string; hosted: boolean };
  latencyMs: number;
};

const STATUS_TONES: Record<string, BadgeTone> = {
  success: "success",
  pending: "info",
  cancelled: "danger",
};

function rangeQuery(range: RangeState) {
  const params = new URLSearchParams();
  if (range.from && range.to) {
    params.set("from", range.from);
    params.set("to", range.to);
  } else {
    params.set("preset", range.preset);
  }
  return params.toString();
}

export function Dashboard({
  initial,
  initialInsights,
  userName,
}: {
  initial: Analytics;
  initialInsights: Insights;
  userName: string;
}) {
  const [range, setRange] = useState<RangeState>({ preset: "30d" });
  const [data, setData] = useState<Analytics>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Insights are server-rendered with the first payload, so there is no mount
  // fetch and no loading flash - only a range change triggers a refetch.
  const [insights, setInsights] = useState<Insights>(initialInsights);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [grain, setGrain] = useState<string>(initial.range.grain);
  const [mapPreset, setMapPreset] = useState("30d");
  const [countries, setCountries] = useState(initial.countries);
  const [mapLoading, setMapLoading] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);

  const load = useCallback(async (next: RangeState, nextGrain?: string) => {
    try {
      const params = rangeQuery(next) + (nextGrain ? `&grain=${nextGrain}` : "");
      const res = await fetch(`/api/analytics?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not refresh the dashboard.");
      const payload = (await res.json()) as Analytics;
      setData(payload);
      setGrain(payload.range.grain);
      setCountries(payload.countries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async (next: RangeState) => {
    try {
      const res = await fetch(`/api/ai/insights?${rangeQuery(next)}`, { cache: "no-store" });
      if (res.ok) setInsights((await res.json()) as Insights);
    } catch {
      /* insights are additive — the dashboard is still useful without them */
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  function changeRange(next: RangeState) {
    setRange(next);
    setLoading(true);
    setError(null);
    setInsightsLoading(true);
    void load(next);
    void loadInsights(next);
  }

  function refresh() {
    setLoading(true);
    setError(null);
    void load(range, grain);
  }

  function changeGrain(next: string) {
    setGrain(next);
    setLoading(true);
    void load(range, next);
  }

  /** The map has its own period, independent of the dashboard range. */
  async function changeMapPreset(next: string) {
    setMapPreset(next);
    setMapLoading(true);
    try {
      const res = await fetch(`/api/analytics?preset=${next}`, { cache: "no-store" });
      if (res.ok) setCountries(((await res.json()) as Analytics).countries);
    } catch {
      /* the map keeps the previous period rather than emptying */
    } finally {
      setMapLoading(false);
    }
  }

  const { kpis } = data;

  return (
    <div className="space-y-5">
      {/* ----------------------------------------------------- Greeting */}
      <Card className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-admin text-lg font-bold text-ink-900">
            <span aria-hidden>👋</span> Hi {userName},{" "}
            <span className="font-normal text-ink-400">here&apos;s what&apos;s happening with your store today.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RangeFilter value={range} onChange={changeRange} onRefresh={refresh} refreshing={loading} />
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            aria-label={statsOpen ? "Collapse the headline stats" : "Expand the headline stats"}
            className="grid size-10 place-items-center rounded-lg border border-line bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900"
          >
            <svg
              viewBox="0 0 20 20"
              className={cn("size-4 transition-transform", !statsOpen && "rotate-180")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m5 12.5 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-[var(--radius-card)] border border-danger/20 bg-danger-soft px-5 py-4">
          <p className="font-admin text-sm font-bold text-danger">{error}</p>
          <button onClick={refresh} className="mt-1 text-[13px] font-semibold text-ink-900 underline">
            Try again
          </button>
        </div>
      )}

      {/* --------------------------------------------------- Stat cards */}
      <div
        hidden={!statsOpen}
        className={cn("grid gap-5 lg:grid-cols-[1.35fr_1fr_1fr]", loading && "opacity-60 transition-opacity")}
      >
        <Card className="flex items-center justify-between gap-4 px-6 py-6">
          <div>
            <p className="font-admin text-[15px] font-bold text-brand-400">Revenue</p>
            <p className="mt-2 font-admin text-[32px] leading-none font-bold text-ink-900">
              {formatCurrency(kpis.revenue.value)}
            </p>
            <p
              className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-400"
              title={`Gross margin ${formatCurrency(kpis.margin.value)} · average order ${formatCurrency(kpis.averageOrder.value)}`}
            >
              <Delta value={kpis.revenue.delta} />
              {kpis.revenue.delta >= 0 ? "increase" : "decrease"} compared to last period
            </p>
          </div>
          <svg viewBox="0 0 120 100" aria-hidden className="hidden h-24 w-28 shrink-0 sm:block">
            <path d="M12 88h96" stroke="#e9edf4" strokeWidth="3" strokeLinecap="round" />
            {[
              { x: 20, h: 26, c: "#ffd0a0" },
              { x: 42, h: 42, c: "#ffb469" },
              { x: 64, h: 56, c: "#ff9f43" },
              { x: 86, h: 72, c: "#f5871f" },
            ].map((bar) => (
              <rect key={bar.x} x={bar.x} y={86 - bar.h} width="16" height={bar.h} rx="4" fill={bar.c} />
            ))}
            <path d="M22 52 L48 38 L70 26 L96 12" stroke="#092c4c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M88 10h10v10" stroke="#092c4c" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-brand-400 px-6 py-6 text-white">
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh bookings"
            className="absolute top-4 right-4 grid size-7 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className={cn("size-4", loading && "animate-spin")} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 13.7 4.7L20 15.5M20 20v-4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <svg viewBox="0 0 24 24" aria-hidden className="size-9 opacity-90" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 20h18M6 20V9M11 20V4M16 20v-7M21 20v-11" strokeLinecap="round" />
          </svg>
          <p className="mt-5 font-admin text-[30px] leading-none font-bold">{formatNumber(kpis.bookings.value)}</p>
          <p
            className="mt-1.5 text-[14px] text-white/85"
            title={`${kpis.bookings.delta >= 0 ? "+" : ""}${kpis.bookings.delta.toFixed(0)}% vs the previous period`}
          >
            No of Total Bookings
          </p>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-ink-900 px-6 py-6 text-white">
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh rental days"
            className="absolute top-4 right-4 grid size-7 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/15 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className={cn("size-4", loading && "animate-spin")} fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 13.7 4.7L20 15.5M20 20v-4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <svg viewBox="0 0 24 24" aria-hidden className="size-9 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            <path d="M5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15" strokeLinecap="round" />
          </svg>
          <p className="mt-5 font-admin text-[30px] leading-none font-bold">{formatNumber(kpis.rentalDays.value)}</p>
          <p
            className="mt-1.5 text-[14px] text-white/70"
            title={`${kpis.rentalDays.delta >= 0 ? "+" : ""}${kpis.rentalDays.delta.toFixed(0)}% vs the previous period · ${formatNumber(kpis.customers.value)} new customers`}
          >
            No of Rental Days Sold
          </p>
        </Card>
      </div>

      {/* ------------------------------ Best sellers + recent bookings */}
      <div className="grid gap-5 min-[1150px]:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader
            title="Best Seller"
            action={
              <Link href="/admin/vehicles" className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900">
                View All
              </Link>
            }
          />
          {data.bestSellers.length === 0 ? (
            <EmptyState title="No sales yet" detail="Nothing has been booked in this period." />
          ) : (
            <ul className="divide-y divide-line">
              {data.bestSellers.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                    <Image src={v.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/cars/${v.slug}`} className="block truncate font-admin text-[14px] font-bold text-ink-900 hover:text-brand-500">
                      {v.name}
                    </Link>
                    <span className="block text-[13px] text-ink-400">{formatCurrency(v.pricePerDay)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12px] text-ink-400">Sales</span>
                    <span className="block font-admin text-[14px] font-bold text-ink-900">{v.sales}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent Transactions"
            action={
              <Link href="/admin/bookings" className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-900">
                View All
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["#", "Order Details", "Payment", "Status", "Amount"].map((h) => (
                    <th key={h} className="px-5 py-3 font-admin text-[13px] font-bold text-ink-900 first:w-12 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recent.map((row, i) => (
                  <tr key={row.id} className="transition-colors hover:bg-canvas">
                    <td className="px-5 py-3.5 text-[13px] text-ink-400">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                          <Image src={row.vehicleImage} alt="" fill sizes="40px" className="object-cover" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-admin text-[14px] font-bold text-ink-900">
                            {row.vehicleName}
                          </span>
                          <span className="flex items-center gap-1 text-[12px] text-ink-400">
                            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" strokeLinecap="round" />
                            </svg>
                            {timeAgo(row.createdAt)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="block text-[13px] text-ink-600">{row.paymentMethod}</span>
                      <span className="block font-mono text-[12px] text-info">{row.reference}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={STATUS_TONES[row.status] ?? "neutral"} dot>
                        {row.status[0].toUpperCase() + row.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ---------------------------------------- Sales chart + world map */}
      <div className="grid gap-5 min-[1150px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Sales Analytics"
            action={
              <span className="relative inline-flex items-center gap-1.5 rounded-lg border border-line bg-white pr-2 pl-2.5">
                <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 3v4M16 3v4M4 11h16" strokeLinecap="round" />
                </svg>
                <select
                  value={grain}
                  onChange={(e) => changeGrain(e.target.value)}
                  aria-label="Chart grouping"
                  className="h-8 cursor-pointer appearance-none bg-transparent pr-1 font-admin text-[12px] font-semibold text-ink-900 outline-none"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </span>
            }
          />
          <div className="p-4">
            <SalesAreaChart data={data.series} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Sales by Countries"
            action={
              <select
                value={mapPreset}
                onChange={(e) => void changeMapPreset(e.target.value)}
                aria-label="Map period"
                className="h-8 rounded-lg border border-line bg-white px-2 font-admin text-[12px] font-semibold text-ink-900 outline-none focus:border-brand-300"
              >
                <option value="7d">This Week</option>
                <option value="30d">This Month</option>
                <option value="90d">This Quarter</option>
                <option value="365d">This Year</option>
              </select>
            }
          />
          <div className={cn("p-4 transition-opacity", mapLoading && "opacity-60")}>
            <WorldSalesMap data={countries} />
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px]">
              <Delta value={data.kpis.revenue.delta} />
              <span className="text-ink-400">
                {data.kpis.revenue.delta >= 0 ? "increase" : "decrease"} compared to the previous period
              </span>
            </p>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------- AI insights */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              AI operations brief
              <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                {insights.engine.hosted ? insights.engine.model : "rules"}
              </span>
            </span>
          }
          action={
            <span className="text-[12px] text-ink-400">
              {insightsLoading ? "Analysing…" : `${insights.latencyMs}ms`}
            </span>
          }
        />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {insightsLoading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)
            : insights.insights.map((insight) => (
                <article
                  key={insight.title}
                  className={cn(
                    "rounded-xl border-l-4 bg-canvas px-4 py-3.5",
                    insight.severity === "warning"
                      ? "border-l-danger"
                      : insight.severity === "positive"
                        ? "border-l-success"
                        : "border-l-info",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-admin text-[14px] font-bold text-ink-900">{insight.title}</h4>
                    <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-ink-600">
                      {insight.metric}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{insight.detail}</p>
                </article>
              ))}
          {!insightsLoading && !insights.insights.length && (
            <p className="col-span-full py-6 text-center text-sm text-ink-400">
              Nothing notable in this window — the numbers are all within normal range.
            </p>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------- Lower charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Booking status" />
          <div className="p-5">
            <StatusDonut data={data.statusMix} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Fleet utilisation" />
          <div className="p-5">
            <UtilisationBars data={data.utilisation} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Booking source" />
          <div className="p-5">
            <SourceBars data={data.sourceMix} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export type { Analytics };
