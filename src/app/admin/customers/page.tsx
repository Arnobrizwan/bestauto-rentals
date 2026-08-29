import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomerRow, type CustomerView } from "@/components/admin/customer-actions";
import { PageHeader, Pagination, TableSearch } from "@/components/admin/table";
import { ExportButton } from "@/components/admin/export-button";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { listCustomers } from "@/server/repositories/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page) ?? 1) || 1);
  const result = await listCustomers({ q: first(params.q), page, pageSize: 12 });

  return (
    <>
      <PageHeader title="Customers" subtitle="Ranked by lifetime value across every completed booking. Contact details are editable from the row — the phone number here is the one the counter dials." >
        <ExportButton dataset="customers" />
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <Suspense fallback={<Skeleton className="h-10 w-full sm:max-w-xs" />}>
            <TableSearch placeholder="Name, email or city" />
          </Suspense>
        </div>

        {result.items.length === 0 ? (
          <EmptyState title="No customers found" detail="Nothing matches that search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="bg-canvas text-left">
                  {["Customer", "Location", "Phone", "Bookings", "Last booking", "Joined", "Lifetime value", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className={cn(
                          "px-5 py-3 font-admin text-[13px] font-bold text-ink-900",
                          (h === "Lifetime value" || h === "Actions") && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((c) => (
                  <CustomerRow
                    key={c.id}
                    customer={{
                      ...c,
                      // Serialised for the client boundary: the query returns
                      // Date objects, and a row component is where they stop
                      // being ones.
                      createdAt: c.createdAt.toISOString(),
                      lastBookingAt: c.lastBookingAt ? new Date(c.lastBookingAt).toISOString() : null,
                    } satisfies CustomerView}
                  />
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
