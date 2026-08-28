"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

export type Facets = {
  brands: string[];
  bodyTypes: string[];
  transmissions: string[];
  fuels: string[];
  locations: string[];
  segments: string[];
  seats: number[];
  priceMin: number;
  priceMax: number;
};

const SORTS = [
  { value: "popular", label: "Most booked" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
];

const SEGMENT_LABELS: Record<string, string> = {
  small: "Small car",
  large: "Large car",
  exclusive: "Exclusive car",
};

const GROUP_CLASS = "border-b border-line pb-5";
const LEGEND_CLASS = "mb-3 font-display text-[13px] font-semibold tracking-wide text-ink-900 uppercase";
const CHIP_CLASS = "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60";

function Chips({
  options,
  current,
  disabled,
  onSelect,
  format,
}: {
  options: (string | number)[];
  current: string | null;
  disabled: boolean;
  onSelect: (value: string | null) => void;
  format?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const value = String(option);
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(active ? null : value)}
            className={cn(
              CHIP_CLASS,
              active
                ? "border-brand-400 bg-brand-400 text-white"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-400",
            )}
          >
            {format ? format(value) : value}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filters write to the URL and let the server component re-render.
 * That keeps results shareable, back-button-correct and server-rendered.
 */
export function FleetFilters({ facets, resultCount }: { facets: Facets; resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [openOnMobile, setOpenOnMobile] = useState(false);

  // The slider needs local state while it is being dragged, but the URL is the
  // source of truth. Keying the input on the URL value remounts it with the
  // right position whenever the URL changes, so no syncing effect is needed.
  const urlPriceMax = Number(params.get("priceMax") ?? facets.priceMax);
  const [draggedPriceMax, setDraggedPriceMax] = useState<number | null>(null);
  const priceMax = draggedPriceMax ?? urlPriceMax;

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  function commitPrice() {
    if (draggedPriceMax === null) return;
    update({ priceMax: draggedPriceMax >= facets.priceMax ? null : String(draggedPriceMax) });
    setDraggedPriceMax(null);
  }

  const activeCount = ["segment", "brand", "bodyType", "transmission", "fuel", "location", "seatsMin", "priceMax", "q"]
    .filter((k) => params.get(k))
    .length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpenOnMobile((v) => !v)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900"
          aria-expanded={openOnMobile}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-brand-400 text-[11px] text-white">
              {activeCount}
            </span>
          )}
        </button>
        <p className="text-sm text-ink-400">{resultCount} cars</p>
      </div>

      <aside
        className={cn(
          "space-y-5 rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24 lg:block",
          openOnMobile ? "block" : "hidden",
        )}
        aria-label="Fleet filters"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink-900">Filters</h2>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
              className="text-[13px] font-medium text-brand-500 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>Search</p>
          <input
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => update({ q: e.target.value || null })}
            placeholder="Brand, model, body type"
            aria-label="Search the fleet"
            className="h-10 w-full rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>Category</p>
          <Chips
            options={facets.segments}
            current={params.get("segment")}
            disabled={pending}
            onSelect={(value) => update({ segment: value })}
            format={(v) => SEGMENT_LABELS[v] ?? v}
          />
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>
            Max price <span className="font-normal text-ink-400 normal-case">£{priceMax} / day</span>
          </p>
          <input
            type="range"
            min={facets.priceMin}
            max={facets.priceMax}
            step={10}
            value={priceMax}
            aria-label="Maximum price per day"
            onChange={(e) => setDraggedPriceMax(Number(e.target.value))}
            onPointerUp={() => commitPrice()}
            onKeyUp={() => commitPrice()}
            className="w-full accent-brand-400"
          />
          <div className="mt-1 flex justify-between text-[11px] text-ink-400">
            <span>£{facets.priceMin}</span>
            <span>£{facets.priceMax}</span>
          </div>
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>Seats</p>
          <Chips
            options={facets.seats}
            current={params.get("seatsMin")}
            disabled={pending}
            onSelect={(value) => update({ seatsMin: value })}
            format={(v) => `${v}+`}
          />
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>Transmission</p>
          <Chips
            options={facets.transmissions}
            current={params.get("transmission")}
            disabled={pending}
            onSelect={(value) => update({ transmission: value })}
          />
        </div>

        <div className={GROUP_CLASS}>
          <p className={LEGEND_CLASS}>Fuel</p>
          <Chips
            options={facets.fuels}
            current={params.get("fuel")}
            disabled={pending}
            onSelect={(value) => update({ fuel: value })}
          />
        </div>

        <div>
          <p className={LEGEND_CLASS}>Branch</p>
          <select
            value={params.get("location") ?? ""}
            onChange={(e) => update({ location: e.target.value || null })}
            aria-label="Collection branch"
            className="h-10 w-full rounded-xl border border-ink-200 px-3 text-sm outline-none focus:border-brand-400"
          >
            <option value="">Any branch</option>
            {facets.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <div className="sr-only" aria-live="polite">
        {pending ? "Updating results" : `${resultCount} cars match your filters`}
      </div>
    </>
  );
}

export function SortSelect({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-400">
        <span className="font-semibold text-ink-900">{resultCount}</span> cars available
      </p>
      <label className="flex items-center gap-2 text-sm text-ink-400">
        Sort
        <select
          value={params.get("sort") ?? "popular"}
          onChange={(e) => {
            const next = new URLSearchParams(params.toString());
            next.set("sort", e.target.value);
            next.delete("page");
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-900 outline-none focus:border-brand-400"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
