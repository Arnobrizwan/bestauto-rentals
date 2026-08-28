import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FleetFilters, SortSelect } from "@/components/site/fleet-filters";
import { VehicleCard, type VehicleCardData } from "@/components/site/vehicle-card";
import { EmptyState, Skeleton } from "@/components/ui";
import { listFacets, listVehicles } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rental deals",
  description: "Browse the Best Auto fleet — filter by category, price, seats, transmission, fuel and branch.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 12;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CarsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);
  const filters = {
    segment: first(params.segment),
    brand: first(params.brand),
    bodyType: first(params.bodyType),
    transmission: first(params.transmission),
    fuel: first(params.fuel),
    location: first(params.location),
    q: first(params.q),
    seatsMin: first(params.seatsMin) ? Number(first(params.seatsMin)) : undefined,
    priceMax: first(params.priceMax) ? Number(first(params.priceMax)) : undefined,
    sort: (first(params.sort) ?? "popular") as "popular",
  };

  const [{ items, total }, facets] = await Promise.all([
    listVehicles({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    listFacets(),
  ]);

  const cards: VehicleCardData[] = items.map((v) => ({
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    bodyType: v.bodyType,
    transmission: v.transmission,
    fuel: v.fuel,
    seats: v.seats,
    bags: v.bags,
    pricePerDay: Number(v.pricePerDay),
    imageUrl: v.imageUrl,
    rating: v.rating,
    reviewCount: v.reviewCount,
    segment: v.segment,
    location: v.location,
    unitsAvailable: v.unitsAvailable,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pickup = first(params.pickup);
  const dropoff = first(params.dropoff);

  function pageHref(n: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = first(value);
      if (v && key !== "page") next.set(key, v);
    }
    next.set("page", String(n));
    return `/cars?${next.toString()}`;
  }

  return (
    <div className="bg-canvas pt-18">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <header className="mb-10">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px] text-ink-400">
            <Link href="/" className="hover:text-ink-900">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="text-ink-900">Rental deals</span>
          </nav>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-900 lg:text-5xl">
            The fleet
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-400">
            {facets.count} cars across {facets.locations.length} UK branches. Prices include VAT, breakdown cover and
            250 miles a day.
          </p>
          {pickup && dropoff && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[13px] text-ink-500">
              <svg viewBox="0 0 24 24" className="size-4 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 3v4M16 3v4M4 11h16" />
              </svg>
              {new Date(pickup).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} &rarr;{" "}
              {new Date(dropoff).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {filters.location ? ` · ${filters.location}` : ""}
            </p>
          )}
        </header>

        <div className="grid gap-8 lg:grid-cols-[268px_1fr]">
          <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
            <FleetFilters facets={facets} resultCount={total} />
          </Suspense>

          <div>
            <Suspense fallback={<Skeleton className="h-10 rounded-xl" />}>
              <SortSelect resultCount={total} />
            </Suspense>

            {cards.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-line bg-white">
                <EmptyState
                  title="No cars match those filters"
                  detail="Try widening the price range or clearing the branch — the fleet is small enough that one filter too many empties it."
                  action={
                    <Link href="/cars" className="mt-3 text-sm font-semibold text-brand-500 hover:underline">
                      Clear all filters
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((v, i) => (
                  <VehicleCard key={v.slug} vehicle={v} priority={i < 3} />
                ))}
              </div>
            )}

            {pageCount > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={pageHref(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={
                      n === page
                        ? "grid size-10 place-items-center rounded-xl bg-ink-900 text-sm font-semibold text-white"
                        : "grid size-10 place-items-center rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-600 hover:border-ink-900"
                    }
                  >
                    {n}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
