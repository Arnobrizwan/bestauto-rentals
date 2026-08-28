"use client";

import { useEffect, useRef, useState } from "react";

import { cn, formatDate } from "@/lib/utils";

export type RangeState = { preset: string; from?: string; to?: string };

const PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
];

export function RangeFilter({
  value,
  onChange,
  onRefresh,
  refreshing,
}: {
  value: RangeState;
  onChange: (next: RangeState) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({ from: value.from ?? "", to: value.to ?? "" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const label =
    value.from && value.to
      ? `${formatDate(value.from)} - ${formatDate(value.to)}`
      : (PRESETS.find((p) => p.value === value.preset)?.label ?? "Last 30 days");

  /**
   * The Figma's greeting bar reads "01 Jan 2024 - 07 Jan 2024".
   *
   * A preset name alone leaves an operator working out which dates "Last 30
   * days" actually covers before they can trust a figure, so a preset shows
   * the window it resolves to alongside its name. A custom range is already
   * literal dates and needs no second copy of them.
   */
  const resolved = (() => {
    if (value.from && value.to) return null;
    const days = Number(String(value.preset).replace("d", "")) || 30;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    return `${formatDate(from)} - ${formatDate(to)}`;
  })();

  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3.5 font-admin text-[13px] font-semibold text-ink-900 transition-colors hover:border-ink-300"
        >
          <svg viewBox="0 0 24 24" className="size-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 3v4M16 3v4M4 11h16" strokeLinecap="round" />
          </svg>
          {label}
          <svg viewBox="0 0 20 20" className={cn("size-3.5 text-ink-400 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {resolved && (
            <span className="hidden font-normal text-ink-400 sm:inline">· {resolved}</span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-lift">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChange({ preset: preset.value });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left font-admin text-[13px] font-semibold transition-colors",
                  value.preset === preset.value && !value.from
                    ? "bg-brand-50 text-brand-500"
                    : "text-ink-600 hover:bg-ink-50",
                )}
              >
                {preset.label}
                {value.preset === preset.value && !value.from && (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}

            <div className="mt-2 border-t border-line pt-3">
              <p className="px-1 pb-2 font-admin text-[11px] font-bold tracking-wide text-ink-400 uppercase">
                Custom range
              </p>
              <div className="flex items-center gap-2 px-1">
                <input
                  type="date"
                  aria-label="From"
                  value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2 text-[12px] outline-none focus:border-brand-400 [color-scheme:light]"
                />
                <input
                  type="date"
                  aria-label="To"
                  value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2 text-[12px] outline-none focus:border-brand-400 [color-scheme:light]"
                />
              </div>
              <button
                type="button"
                disabled={!custom.from || !custom.to || custom.to < custom.from}
                onClick={() => {
                  onChange({ preset: "custom", from: custom.from, to: custom.to });
                  setOpen(false);
                }}
                className="mt-2 h-9 w-full rounded-lg bg-ink-900 font-admin text-[13px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh data"
        className="grid size-10 place-items-center rounded-lg border border-line bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900"
      >
        <svg
          viewBox="0 0 24 24"
          className={cn("size-4", refreshing && "animate-spin")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 13.7 4.7L20 15.5M20 20v-4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
