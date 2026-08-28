import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { FilterTabs, PageHeader, SortMenu, TableSearch } from "@/components/admin/table";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { listVehicles } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vehicles" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function VehiclesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const segment = first(params.segment) ?? "all";
  const sort = (first(params.sort) ?? "popular") as "popular";

  const { items } = await listVehicles({ segment, q: first(params.q), sort });

  const fleetValue = items.reduce((sum, v) => sum + Number(v.pricePerDay) * v.unitsTotal, 0);
  const totalUnits = items.reduce((sum, v) => sum + v.unitsTotal, 0);
  const available = items.reduce((sum, v) => sum + v.unitsAvailable, 0);

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={`${items.length} models · ${totalUnits} units · ${available} available right now`}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Models in fleet", value: formatNumber(items.length) },
          { label: "Units available", value: `${available} / ${totalUnits}` },
          { label: "Daily list value", value: formatCurrency(fleetValue) },
        ].map((stat) => (
          <Card key={stat.label} className="px-5 py-4">
            <p className="text-[13px] text-ink-400">{stat.label}</p>
            <p className="mt-1 font-admin text-xl font-bold text-ink-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Search by name, brand or body type" />
          </Suspense>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <FilterTabs
                name="segment"
                options={[
                  { value: "all", label: "All" },
                  { value: "small", label: "Small" },
                  { value: "large", label: "Large" },
                  { value: "exclusive", label: "Exclusive" },
                ]}
              />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-10 w-40" />}>
              <SortMenu
                options={[
                  { value: "popular", label: "Most booked" },
                  { value: "price-desc", label: "Highest price" },
                  { value: "price-asc", label: "Lowest price" },
                  { value: "rating", label: "Best rated" },
                  { value: "newest", label: "Newest" },
                ]}
              />
            </Suspense>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="No vehicles match" detail="Try clearing the search or switching category." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["Vehicle", "Category", "Specs", "Price / day", "Availability", "Bookings", "Revenue"].map((h) => (
                    <th key={h} className="px-5 py-3 font-admin text-[13px] font-bold text-ink-900 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((v) => {
                  const availability = v.unitsTotal ? (v.unitsAvailable / v.unitsTotal) * 100 : 0;
                  return (
                    <tr key={v.id} className="transition-colors hover:bg-canvas">
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                            <Image src={v.imageUrl} alt="" fill sizes="44px" className="object-cover" />
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={`/cars/${v.slug}`}
                              className="block truncate font-admin text-[14px] font-bold text-ink-900 hover:text-brand-500"
                            >
                              {v.name}
                            </Link>
                            <span className="block text-[12px] text-ink-400">
                              {v.year} · {v.location}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={v.segment === "exclusive" ? "softWarning" : "neutral"}>{v.segment}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-ink-500">
                        {v.seats} seats · {v.transmission} · {v.fuel}
                      </td>
                      <td className="px-5 py-3.5 font-admin text-[14px] font-bold text-ink-900">
                        {formatCurrency(Number(v.pricePerDay))}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                            <span
                              className={cn(
                                "block h-full rounded-full",
                                availability > 50 ? "bg-success" : availability > 20 ? "bg-brand-400" : "bg-danger",
                              )}
                              style={{ width: `${Math.max(6, availability)}%` }}
                            />
                          </span>
                          <span className="text-[13px] text-ink-500">
                            {v.unitsAvailable}/{v.unitsTotal}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-admin text-[14px] font-bold text-ink-900">{v.bookingCount}</td>
                      <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
                        {formatCurrency(v.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
