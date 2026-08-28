import type { Metadata } from "next";

import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/table";
import { formatCurrency, formatNumber, percent } from "@/lib/utils";
import { getSpecs } from "@/server/repositories/catalogue";
import type { CatalogueGroup } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Specs" };

function SpecTable({ label, rows, suffix }: { label: string; rows: CatalogueGroup[]; suffix?: string }) {
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  return (
    <section className="mb-5">
      <h2 className="mb-2 font-admin text-[15px] font-bold text-ink-900">{label}</h2>
      <DataTable
        rowCount={rows.length}
        minWidth={720}
        columns={[
          { label },
          { label: "Models" },
          { label: "Units" },
          { label: "Average price" },
          { label: "Bookings", align: "right" },
          { label: "Revenue", align: "right" },
          { label: "Share", align: "right" },
        ]}
        empty={{ title: `No ${label.toLowerCase()} recorded`, detail: "The fleet has nothing to group." }}
      >
        {rows.map((r) => (
          <Tr key={r.key}>
            <Td strong>
              {r.key}
              {suffix}
            </Td>
            <Td>{formatNumber(r.models)}</Td>
            <Td>{formatNumber(r.units)}</Td>
            <Td>{formatCurrency(r.avgPrice)}</Td>
            <Td align="right">{formatNumber(r.bookingCount)}</Td>
            <Td align="right" strong>
              {formatCurrency(r.revenue)}
            </Td>
            <Td align="right">{percent(revenue ? (r.revenue / revenue) * 100 : 0)}</Td>
          </Tr>
        ))}
      </DataTable>
    </section>
  );
}

export default async function SpecsPage() {
  const { transmission, fuel, seats } = await getSpecs();

  return (
    <>
      <PageHeader
        title="Specs"
        subtitle="The three attributes a customer filters on — gearbox, fuel and seating — and how demand splits across each"
      />
      <SpecTable label="Transmission" rows={transmission} />
      <SpecTable label="Fuel" rows={fuel} />
      <SpecTable label="Seats" rows={seats} suffix=" seats" />
    </>
  );
}
