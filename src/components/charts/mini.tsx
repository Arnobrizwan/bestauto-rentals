"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn, formatCurrency, formatNumber } from "@/lib/utils";

const STATUS_COLOURS: Record<string, string> = {
  success: "#28c76f",
  pending: "#2e9bf5",
  cancelled: "#ea5455",
};

export function StatusDonut({ data }: { data: { status: string; n: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.n, 0);
  if (!total) return <p className="py-10 text-center text-sm text-ink-400">No bookings in this period.</p>;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-[132px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="n" nameKey="status" innerRadius={44} outerRadius={64} paddingAngle={3} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.status} fill={STATUS_COLOURS[d.status] ?? "#cbd5e1"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${Number(value ?? 0)} bookings`, String(name ?? "")]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e9edf4", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/*
          "all statuses", not "total": the KPI tile above counts confirmed
          bookings only, so an unqualified "total" here read as a second,
          contradictory figure for the same noun.
        */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="font-admin text-xl font-bold text-ink-900">{formatNumber(total)}</p>
          <p className="text-[11px] leading-tight text-ink-400">
            all
            <br />
            statuses
          </p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOURS[d.status] ?? "#cbd5e1" }} />
            <span className="flex-1 truncate text-[13px] text-ink-500 capitalize">{d.status}</span>
            <span className="font-admin text-[13px] font-bold text-ink-900">
              {Math.round((d.n / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UtilisationBars({
  data,
}: {
  data: { segment: string; utilisation: number; rentalDays: number; revenue: number; units: number }[];
}) {
  if (!data.length) return <p className="py-10 text-center text-sm text-ink-400">No utilisation data.</p>;
  const sorted = [...data].sort((a, b) => b.utilisation - a.utilisation);

  return (
    <ul className="space-y-4">
      {sorted.map((row) => (
        <li key={row.segment}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-admin text-[13px] font-bold text-ink-900 capitalize">{row.segment}</span>
            <span className="text-[12px] text-ink-400">
              {row.units} units · {row.rentalDays} rental days · {formatCurrency(row.revenue)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  row.utilisation > 55 ? "bg-success" : row.utilisation > 25 ? "bg-brand-400" : "bg-danger",
                )}
                style={{ width: `${Math.max(2, Math.min(100, row.utilisation))}%` }}
              />
            </div>
            <span className="w-11 shrink-0 text-right font-admin text-[13px] font-bold text-ink-900">
              {row.utilisation.toFixed(0)}%
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export const SOURCE_LABELS: Record<string, string> = {
  web: "Web",
  "ai-concierge": "AI concierge",
  phone: "Phone",
  partner: "Partner",
};

export function SourceBars({ data }: { data: { source: string; n: number; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  if (!data.length) return <p className="py-10 text-center text-sm text-ink-400">No attributed bookings.</p>;

  return (
    <ul className="space-y-3.5">
      {data.map((row) => (
        <li key={row.source} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[13px] text-ink-500">
            {SOURCE_LABELS[row.source] ?? row.source.replace(/-/g, " ")}
          </span>
          <div className="h-7 flex-1 overflow-hidden rounded-md bg-ink-50">
            <div
              className={cn(
                "flex h-full items-center justify-end rounded-md px-2 transition-all duration-700",
                row.source === "ai-concierge" ? "bg-ink-900" : "bg-brand-300",
              )}
              style={{ width: `${Math.max(12, (row.n / max) * 100)}%` }}
            >
              <span className="font-admin text-[11px] font-bold text-white">{row.n}</span>
            </div>
          </div>
          <span className="w-20 shrink-0 text-right text-[12px] text-ink-400">{formatCurrency(row.revenue)}</span>
        </li>
      ))}
    </ul>
  );
}
