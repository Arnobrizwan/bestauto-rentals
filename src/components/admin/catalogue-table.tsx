import { DataTable, Td, Tr } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { Badge } from "@/components/ui";
import { cn, formatCurrency, formatNumber, percent } from "@/lib/utils";
import type { CatalogueGroup } from "@/server/repositories/catalogue";

/**
 * Segments, body types and brands are the same question asked of three
 * columns, so they render through one component. Each row carries what the
 * grouping is worth — models, units, price band and the revenue it earned —
 * because a catalogue view that only counts rows tells an operator nothing.
 */
export function CatalogueView({
  title,
  subtitle,
  keyLabel,
  rows,
  capitalise = false,
}: {
  title: string;
  subtitle: string;
  keyLabel: string;
  rows: CatalogueGroup[];
  capitalise?: boolean;
}) {
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const units = rows.reduce((sum, r) => sum + r.units, 0);
  const models = rows.reduce((sum, r) => sum + r.models, 0);
  const top = rows.reduce<CatalogueGroup | null>((best, r) => (!best || r.revenue > best.revenue ? r : best), null);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <StatRow
        stats={[
          { label: keyLabel + "s", value: formatNumber(rows.length) },
          { label: "Models", value: formatNumber(models), detail: `${formatNumber(units)} units` },
          { label: "Revenue", value: formatCurrency(revenue) },
          {
            label: "Top earner",
            value: top ? (capitalise ? top.key : top.key) : "—",
            detail: top ? formatCurrency(top.revenue) : undefined,
            tone: "warning",
          },
        ]}
      />

      <DataTable
        rowCount={rows.length}
        minWidth={860}
        columns={[
          { label: keyLabel },
          { label: "Models" },
          { label: "Units" },
          { label: "Price band" },
          { label: "Rating" },
          { label: "Bookings", align: "right" },
          { label: "Revenue", align: "right" },
          { label: "Share", align: "right" },
        ]}
        empty={{ title: `No ${keyLabel.toLowerCase()}s yet`, detail: "The fleet has nothing to group." }}
      >
        {rows.map((r) => (
          <Tr key={r.key}>
            <Td strong>
              <span className={cn(capitalise && "capitalize")}>{r.key}</span>
            </Td>
            <Td>{formatNumber(r.models)}</Td>
            <Td>
              {formatNumber(r.available)} / {formatNumber(r.units)}
            </Td>
            <Td>
              {r.minPrice === r.maxPrice
                ? formatCurrency(r.minPrice)
                : `${formatCurrency(r.minPrice)} – ${formatCurrency(r.maxPrice)}`}
            </Td>
            <Td>
              <Badge tone={r.avgRating >= 4.7 ? "softSuccess" : "neutral"}>{r.avgRating.toFixed(1)}</Badge>
            </Td>
            <Td align="right">{formatNumber(r.bookingCount)}</Td>
            <Td align="right" strong>
              {formatCurrency(r.revenue)}
            </Td>
            <Td align="right">
              <span className="flex items-center justify-end gap-2">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-brand-400"
                    style={{ width: `${revenue ? Math.max(3, (r.revenue / revenue) * 100) : 0}%` }}
                  />
                </span>
                <span className="tabular-nums">{percent(revenue ? (r.revenue / revenue) * 100 : 0)}</span>
              </span>
            </Td>
          </Tr>
        ))}
      </DataTable>
    </>
  );
}
