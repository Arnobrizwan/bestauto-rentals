import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DateRangeFilter } from "@/components/site/date-range-filter";
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

  // The searched dates now narrow the fleet instead of only labelling it. Both
  // ends are required and must be ordered; a half or reversed range is ignored
  // rather than silently listing everything as if no dates were given.
  const pickupParam = first(params.pickup);
  const dropoffParam = first(params.dropoff);
  const from = pickupParam ? new Date(pickupParam) : null;
  const to = dropoffParam ? new Date(dropoffParam) : null;
  const validRange =
    from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to;
  if (validRange) to.setHours(23, 59, 59, 999);

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
    availableFrom: validRange ? from : undefined,
    availableTo: validRange ? to : undefined,
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
            {facets.count} cars across {facets.locations.length} branches. Rates include a driver and 120km a day inside
            Dhaka; fuel is billed at cost.
          </p>
          <Suspense fallback={<Skeleton className="mt-4 h-14 w-96 max-w-full rounded-xl" />}>
            <DateRangeFilter key={`${pickupParam ?? ""}-${dropoffParam ?? ""}`} pickup={pickupParam} dropoff={dropoffParam} />
          </Suspense>
          {validRange && (
            <p className="mt-2 text-[13px] text-ink-400">
              Showing cars with a unit free for these dates
              {filters.location ? ` at ${filters.location}` : ""}.
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
