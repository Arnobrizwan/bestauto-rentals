"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { VehicleCard, type VehicleCardData } from "./vehicle-card";

const TABS = [
  { id: "popular", label: "Popular" },
  { id: "large", label: "Large Car" },
  { id: "small", label: "Small Car" },
  { id: "exclusive", label: "Exclusive Car" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PAGE_SIZE = 8;

/**
 * The "Most popular car rental deals" section.
 *
 * Tabs hit the live /api/vehicles endpoint rather than filtering a hard-coded
 * array, so the section reflects whatever is actually in the fleet.
 */
export function Deals({ initial, initialTotal }: { initial: VehicleCardData[]; initialTotal: number }) {
  const [tab, setTab] = useState<TabId>("popular");
  const [items, setItems] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (nextTab: TabId, nextPage: number, append: boolean) => {
    const token = ++requestRef.current;
    try {
      const params = new URLSearchParams({
        segment: nextTab,
        sort: nextTab === "popular" ? "popular" : "rating",
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/vehicles?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load the fleet.");
      const data = (await res.json()) as { items: VehicleCardData[]; total: number };
      // Ignore responses from a tab the user has already navigated away from.
      if (token !== requestRef.current) return;
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
    } catch (err) {
      if (token !== requestRef.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (token === requestRef.current) setLoading(false);
    }
  }, []);

  // The first page is server-rendered, so there is no mount fetch: loading is
  // driven entirely by what the visitor does.
  function selectTab(next: TabId) {
    if (next === tab) return;
    setTab(next);
    setPage(1);
    setLoading(true);
    setError(null);
    void load(next, 1, false);
  }

  function showMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoading(true);
    setError(null);
    void load(tab, nextPage, true);
  }

  function retry() {
    setLoading(true);
    setError(null);
    void load(tab, page, false);
  }

  const hasMore = items.length < total;

  return (
    <section id="deals" className="bg-canvas py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <header className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[42px]">
            Most popular car rental deals
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
            A high-performing web-based car rental system for any rent-a-car company and website.
          </p>
        </header>

        <div className="mt-10 overflow-x-auto no-scrollbar" data-reveal data-reveal-delay="60">
          <div
            role="tablist"
            aria-label="Vehicle categories"
            className="mx-auto flex min-w-max justify-center gap-1 border-b border-line"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={cn(
                  "relative px-6 py-4 text-[15px] font-medium transition-colors sm:px-10",
                  tab === t.id ? "text-ink-900" : "text-ink-400 hover:text-ink-700",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-all duration-300",
                    tab === t.id ? "bg-ink-900" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-12 rounded-2xl border border-danger/20 bg-danger-soft px-6 py-8 text-center">
            <p className="text-sm font-semibold text-danger">{error}</p>
            <button
              onClick={retry}
              className="mt-3 text-sm font-medium text-ink-900 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "mt-10 grid gap-5 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-4",
              loading && "opacity-60",
            )}
          >
            {items.map((v, i) => (
              <VehicleCard key={v.slug} vehicle={v} priority={i < 4} />
            ))}
            {loading && !items.length
              ? Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-[366px] animate-pulse rounded-2xl border border-line bg-white" />
                ))
              : null}
          </div>
        )}

        {!error && !items.length && !loading && (
          <p className="mt-12 text-center text-[15px] text-ink-400">
            Nothing in this category right now — try another tab.
          </p>
        )}

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={!hasMore || loading}
            onClick={showMore}
            className="inline-flex h-12 items-center rounded-full border border-ink-200 bg-white px-8 text-sm font-semibold text-ink-900 transition-all hover:border-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Loading…" : hasMore ? "Show more car" : "That's the whole fleet"}
          </button>
          <span className="text-sm text-ink-400 sm:absolute sm:right-8">{total} Car</span>
        </div>
      </div>
    </section>
  );
}
