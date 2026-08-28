"use client";

import { useState } from "react";

import { formatCurrency } from "@/lib/utils";

import { WORLD_SHAPES, WORLD_VIEWBOX } from "./world-shapes";

export type CountrySales = { country: string; countryCode: string; sales: number; revenue: number };

/**
 * The "Sales by Countries" choropleth.
 *
 * Country outlines are pre-projected at build time (scripts/build-world-map.mts)
 * so no mapping library or topojson reaches the browser — just path strings.
 */
export function WorldSalesMap({ data }: { data: CountrySales[] }) {
  const [hovered, setHovered] = useState<CountrySales | null>(null);

  const byCode = new Map(data.map((d) => [d.countryCode, d]));
  const max = Math.max(1, ...data.map((d) => d.sales));
  const top = data[0] ?? null;
  const active = hovered ?? top;

  function fillFor(code: string) {
    const row = byCode.get(code);
    if (!row) return "#eef1f6";
    const intensity = row.sales / max;
    if (intensity > 0.66) return "#092c4c";
    if (intensity > 0.33) return "#ff9f43";
    return "#ffd0a0";
  }

  return (
    <div className="relative">
      <svg
        viewBox={WORLD_VIEWBOX}
        role="img"
        aria-label="Bookings by country"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {WORLD_SHAPES.map((shape) => {
          const row = byCode.get(shape.id);
          return (
            <path
              key={shape.id}
              d={shape.d}
              fill={fillFor(shape.id)}
              stroke="#ffffff"
              strokeWidth={0.4}
              className={row ? "cursor-pointer transition-opacity hover:opacity-80" : undefined}
              onMouseEnter={() => row && setHovered(row)}
              onMouseLeave={() => setHovered(null)}
            >
              {row && <title>{`${row.country}: ${row.sales} bookings`}</title>}
            </path>
          );
        })}
      </svg>

      {active && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-white shadow-lift">
          <p className="bg-brand-400 px-6 py-2 text-center font-admin text-[13px] font-bold text-white">
            {active.country}
          </p>
          <p className="px-6 py-2.5 text-center font-admin text-[14px] font-semibold text-ink-900">
            {active.sales} Sales
          </p>
          <p className="border-t border-line px-6 py-1.5 text-center text-[12px] text-ink-400">
            {formatCurrency(active.revenue)}
          </p>
        </div>
      )}

      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-ink-400">
        {[
          { colour: "#092c4c", label: "High" },
          { colour: "#ff9f43", label: "Medium" },
          { colour: "#ffd0a0", label: "Low" },
          { colour: "#eef1f6", label: "No bookings" },
        ].map((key) => (
          <li key={key.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: key.colour }} />
            {key.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
