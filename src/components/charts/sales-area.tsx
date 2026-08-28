"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCompact, formatCurrency } from "@/lib/utils";

export type SalesPoint = { bucket: string; label: string; revenue: number; orders: number; cancelled: number };

type TooltipPayload = { payload: SalesPoint }[];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-lift">
      <p className="font-admin text-[12px] font-bold text-ink-900">{point.label}</p>
      <p className="mt-1 font-admin text-[15px] font-bold text-brand-500">{formatCurrency(point.revenue)}</p>
      <p className="mt-0.5 text-[12px] text-ink-400">
        {point.orders} booking{point.orders === 1 ? "" : "s"}
        {point.cancelled > 0 ? ` · ${point.cancelled} cancelled` : ""}
      </p>
    </div>
  );
}

/**
 * The Sales Analytics area chart from the design — same gradient fill and
 * dotted vertices, driven by whatever the range filter returns.
 */
export function SalesAreaChart({ data }: { data: SalesPoint[] }) {
  if (!data.length) {
    return (
      <div className="grid h-[300px] place-items-center text-sm text-ink-400">
        No bookings in this period.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9f43" stopOpacity={0.55} />
              <stop offset="55%" stopColor="#ff9f43" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#ff9f43" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            dy={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v: number) => formatCompact(v)}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ff9f43", strokeWidth: 1, strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#ff9f43"
            strokeWidth={2.5}
            fill="url(#salesFill)"
            dot={{ r: 3.5, fill: "#ff9f43", strokeWidth: 0 }}
            activeDot={{ r: 6, fill: "#ff9f43", stroke: "#fff", strokeWidth: 2.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
