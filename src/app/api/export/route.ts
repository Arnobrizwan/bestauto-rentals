import { requireAdmin } from "@/lib/auth/server";
import { toCsv, csvHeaders } from "@/lib/csv";
import { fail, guard } from "@/lib/security/http";
import { resolveRange } from "@/server/repositories/analytics";
import { listBookings } from "@/server/repositories/bookings";
import { listCustomers } from "@/server/repositories/customers";
import { listLeads } from "@/server/repositories/leads";
import { listVehicles } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";

const first = (params: URLSearchParams, key: string) => params.get(key) ?? undefined;

/**
 * CSV export of any admin table.
 *
 * It re-runs the same query the page ran, from the same query string, so what
 * downloads is what the operator is looking at — including the filters, and
 * *not* only the page they happen to be on, which is the usual trap. The row
 * cap is there so an export cannot become an accidental full-table scan.
 */

/**
 * Collects every page of a listing.
 *
 * The repositories clamp `pageSize` to 100 so a stray query string cannot ask
 * for the whole table in one statement. An export legitimately wants all of
 * it, so it pages instead of loosening that clamp, and stops at a cap so this
 * cannot become an unbounded scan either.
 */
async function collect<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  cap = 5000,
): Promise<T[]> {
  const pageSize = 100;
  const out: T[] = [];
  for (let page = 1; out.length < cap; page += 1) {
    const { items } = await fetchPage(page, pageSize);
    out.push(...items);
    if (items.length < pageSize) break;
  }
  return out.slice(0, cap);
}

export async function GET(req: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const limited = guard(req, "export", 20);
  if (limited) return limited;

  const params = new URL(req.url).searchParams;
  const dataset = params.get("dataset") ?? "";
  // Same period the page is showing, so the file matches the screen.
  const hasPeriod = params.get("range") || (params.get("from") && params.get("to"));
  const range = hasPeriod
    ? resolveRange(first(params, "range"), first(params, "from"), first(params, "to"))
    : undefined;
  const LIMIT = 5000;

  switch (dataset) {
    case "bookings": {
      const items = await collect(
        (page, pageSize) =>
          listBookings({
            status: first(params, "status"),
            q: first(params, "q"),
            sort: first(params, "sort") as never,
            from: range?.from,
            to: range?.to,
            page,
            pageSize,
          }),
        LIMIT,
      );
      return new Response(
        toCsv(
          [
            { key: "reference", label: "Reference" },
            { key: "customerName", label: "Customer" },
            { key: "customerEmail", label: "Email" },
            { key: "vehicleName", label: "Vehicle" },
            { key: "pickupLocation", label: "Collected from" },
            { key: "pickupAt", label: "Out" },
            { key: "dropoffAt", label: "Back" },
            { key: "days", label: "Days" },
            { key: "status", label: "Status" },
            { key: "paymentMethod", label: "Payment" },
            { key: "couponCode", label: "Code" },
            { key: "total", label: "Total (BDT)" },
            { key: "createdAt", label: "Booked" },
          ],
          items as unknown as Record<string, unknown>[],
        ),
        { headers: csvHeaders("bookings") },
      );
    }

    case "leads": {
      const items = await collect(
        (page, pageSize) => listLeads({ tier: first(params, "tier"), q: first(params, "q"), page, pageSize }),
        LIMIT,
      );
      return new Response(
        toCsv(
          [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "company", label: "Company" },
            { key: "intent", label: "Intent" },
            { key: "partySize", label: "Party size" },
            { key: "budgetPerDay", label: "Budget / day (BDT)" },
            { key: "timeframe", label: "Timeframe" },
            { key: "score", label: "AI score" },
            { key: "tier", label: "Tier" },
            { key: "status", label: "Status" },
            { key: "aiNextAction", label: "Next action" },
            { key: "createdAt", label: "Received" },
          ],
          items as unknown as Record<string, unknown>[],
        ),
        { headers: csvHeaders("leads") },
      );
    }

    case "customers": {
      const items = await collect(
        (page, pageSize) => listCustomers({ q: first(params, "q"), page, pageSize }),
        LIMIT,
      );
      return new Response(
        toCsv(
          [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "city", label: "City" },
            { key: "country", label: "Country" },
            { key: "bookingCount", label: "Bookings" },
            { key: "totalSpend", label: "Lifetime value (BDT)" },
            { key: "createdAt", label: "First seen" },
          ],
          items as unknown as Record<string, unknown>[],
        ),
        { headers: csvHeaders("customers") },
      );
    }

    case "vehicles": {
      const items = await collect(
        (page, pageSize) =>
          listVehicles({ segment: first(params, "segment"), q: first(params, "q"), limit: pageSize, offset: (page - 1) * pageSize }),
        LIMIT,
      );
      return new Response(
        toCsv(
          [
            { key: "name", label: "Vehicle" },
            { key: "brand", label: "Brand" },
            { key: "segment", label: "Segment" },
            { key: "bodyType", label: "Body type" },
            { key: "seats", label: "Seats" },
            { key: "transmission", label: "Transmission" },
            { key: "fuel", label: "Fuel" },
            { key: "location", label: "Branch" },
            { key: "pricePerDay", label: "Price / day (BDT)" },
            { key: "unitsAvailable", label: "Available" },
            { key: "unitsTotal", label: "Units" },
            { key: "bookingCount", label: "Bookings" },
            { key: "revenue", label: "Revenue (BDT)" },
          ],
          items as unknown as Record<string, unknown>[],
        ),
        { headers: csvHeaders("vehicles") },
      );
    }

    default:
      return fail(422, "Unknown dataset. Use bookings, leads, customers or vehicles.");
  }
}
