import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { FilterTabs, PageHeader, Pagination, SortMenu, TableSearch } from "@/components/admin/table";
import { ExportButton } from "@/components/admin/export-button";
import { SOURCE_LABELS } from "@/components/charts/mini";
import { Badge, Card, EmptyState, Skeleton, type BadgeTone } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listBookings } from "@/server/repositories/bookings";
import { getStatusMix, resolveRange } from "@/server/repositories/analytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bookings" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TONES: Record<string, BadgeTone> = { success: "success", pending: "info", cancelled: "danger" };

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);

  // The dashboard tiles link here with the period they were counted over, so
  // the table has to honour it — otherwise "601 bookings" lands on a list
  // filtered to something else and the figure looks wrong. With no period in
  // the query string this stays the full history it has always been.
  const periodParam = first(params.range) ?? (first(params.from) && first(params.to) ? "custom" : undefined);
  const range = periodParam ? resolveRange(first(params.range), first(params.from), first(params.to)) : undefined;

  const [result, mix] = await Promise.all([
    listBookings({
      status: first(params.status),
      q: first(params.q),
      sort: (first(params.sort) ?? "newest") as "newest",
      from: range?.from,
      to: range?.to,
      page,
      pageSize: 12,
    }),
    // The facet counts describe the same period as the rows beneath them.
    getStatusMix(range ?? resolveRange("365d")),
  ]);

  const countFor = (status: string) => mix.find((m) => m.status === status)?.n;
  const allCount = mix.reduce((sum, m) => sum + m.n, 0);

  return (
    <>
      <PageHeader
        title="Bookings"
        subtitle={
          range
            ? `${formatDate(range.from)} - ${formatDate(range.to)} · ${allCount} in this period`
            : "Every reservation the platform has taken, newest first."
        }
      >
        <ExportButton dataset="bookings" />
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Reference, customer or vehicle" />
          </Suspense>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <Suspense fallback={<Skeleton className="h-10 w-72" />}>
              <FilterTabs
                name="status"
                options={[
                  { value: "all", label: "All", count: allCount },
                  { value: "success", label: "Success", count: countFor("success") },
                  { value: "pending", label: "Pending", count: countFor("pending") },
                  { value: "cancelled", label: "Cancelled", count: countFor("cancelled") },
                ]}
              />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-10 w-40" />}>
              <SortMenu
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "amount-desc", label: "Highest value" },
                  { value: "amount-asc", label: "Lowest value" },
                ]}
              />
            </Suspense>
          </div>
        </div>

        {result.items.length === 0 ? (
          <EmptyState title="No bookings found" detail="Nothing matches that search or filter combination." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["Reference", "Vehicle", "Customer", "Dates", "Source", "Status", "Total"].map((h) => (
                    <th key={h} className="px-5 py-3 font-admin text-[13px] font-bold text-ink-900 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-canvas">
                    <td className="px-5 py-3.5">
                      <span className="block font-mono text-[12px] text-info">{b.reference}</span>
                      <span className="block text-[12px] text-ink-400">{formatDate(b.createdAt)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                          <Image src={b.vehicleImage} alt="" fill sizes="36px" className="object-cover" />
                        </span>
                        <Link
                          href={`/cars/${b.vehicleSlug}`}
                          className="truncate font-admin text-[14px] font-bold text-ink-900 hover:text-brand-500"
                        >
                          {b.vehicleName}
                        </Link>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="block truncate text-[13px] font-semibold text-ink-900">{b.customerName}</span>
                      <span className="block truncate text-[12px] text-ink-400">{b.customerCountry}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-500">
                      {formatDate(b.pickupAt, { day: "2-digit", month: "short" })} &rarr;{" "}
                      {formatDate(b.dropoffAt, { day: "2-digit", month: "short" })}
                      <span className="block text-[12px] text-ink-400">
                        {b.days} {b.days === 1 ? "day" : "days"} · {b.pickupLocation}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-ink-500">{SOURCE_LABELS[b.source] ?? b.source}</span>
                      <span className="block text-[12px] text-ink-400">{b.paymentMethod}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={TONES[b.status] ?? "neutral"} dot>
                        {b.status[0].toUpperCase() + b.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-admin text-[14px] font-bold text-ink-900">
                      {formatCurrency(b.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Suspense fallback={null}>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} />
        </Suspense>
      </Card>
    </>
  );
}
