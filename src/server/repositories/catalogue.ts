import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/server/db/client";
import { bookings, vehicles } from "@/server/db/schema";

/**
 * Fleet taxonomy views.
 *
 * The Figma's Inventory group splits a catalogue four ways — Category, Sub
 * Category, Brands and Variant Attributes. The rental equivalents are segment,
 * body type, brand and spec, and all four are the same shape of question:
 * group the fleet one way, then attach what it earned. Sharing `groupedBy`
 * keeps that honest — every one of these pages is the same aggregate over a
 * different column, so they cannot drift apart.
 */
async function groupedBy(column: AnyPgColumn) {
  const rows = await db
    .select({
      key: sql<string>`${column}::text`,
      models: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${vehicles.unitsTotal}), 0)::int`,
      available: sql<number>`coalesce(sum(${vehicles.unitsAvailable}), 0)::int`,
      avgPrice: sql<number>`coalesce(avg(${vehicles.pricePerDay}::numeric), 0)::float8`,
      minPrice: sql<number>`coalesce(min(${vehicles.pricePerDay}::numeric), 0)::float8`,
      maxPrice: sql<number>`coalesce(max(${vehicles.pricePerDay}::numeric), 0)::float8`,
      avgRating: sql<number>`coalesce(avg(${vehicles.rating}), 0)::float8`,
    })
    .from(vehicles)
    .groupBy(column)
    .orderBy(desc(sql`count(*)`));

  // Bookings are counted in a second pass rather than joined into the query
  // above: a one-to-many join would repeat each vehicle row per booking and
  // quietly skew every price average on the page.
  const performance = await db
    .select({
      key: sql<string>`${column}::text`,
      bookingCount: sql<number>`count(${bookings.id})::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(vehicles)
    .leftJoin(bookings, and(eq(bookings.vehicleId, vehicles.id), eq(bookings.status, "success")))
    .groupBy(column);

  const perf = new Map(performance.map((p) => [p.key, p]));

  return rows.map((r) => ({
    key: r.key,
    models: r.models,
    units: r.units,
    available: r.available,
    avgPrice: Number(r.avgPrice),
    minPrice: Number(r.minPrice),
    maxPrice: Number(r.maxPrice),
    avgRating: Number(r.avgRating),
    bookingCount: perf.get(r.key)?.bookingCount ?? 0,
    revenue: Number(perf.get(r.key)?.revenue ?? 0),
  }));
}

export type CatalogueGroup = Awaited<ReturnType<typeof groupedBy>>[number];

export const getSegments = () => groupedBy(vehicles.segment);
export const getBodyTypes = () => groupedBy(vehicles.bodyType);
export const getBrands = () => groupedBy(vehicles.brand);

/** Variant attributes: transmission, fuel and seating, each with its spread. */
export async function getSpecs() {
  const [transmission, fuel, seats] = await Promise.all([
    groupedBy(vehicles.transmission),
    groupedBy(vehicles.fuel),
    groupedBy(vehicles.seats),
  ]);
  return { transmission, fuel, seats };
}

/**
 * Models running short of stock.
 *
 * `unitsAvailable` against `unitsTotal` is the standing position; the booking
 * count over the last thirty days is what says whether a thin model is a
 * problem or simply unpopular.
 */
export async function getLowAvailability(threshold = 0.4) {
  const rows = await db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      name: vehicles.name,
      segment: vehicles.segment,
      location: vehicles.location,
      imageUrl: vehicles.imageUrl,
      pricePerDay: sql<number>`${vehicles.pricePerDay}::float8`,
      unitsTotal: vehicles.unitsTotal,
      unitsAvailable: vehicles.unitsAvailable,
      recentBookings: sql<number>`(
        select count(*)::int from ${bookings}
        where ${bookings.vehicleId} = ${vehicles.id}
          and ${bookings.status} = 'success'
          and ${bookings.createdAt} >= current_date - 30
      )`,
    })
    .from(vehicles)
    .orderBy(asc(sql`case when ${vehicles.unitsTotal} = 0 then 1 else ${vehicles.unitsAvailable}::float / ${vehicles.unitsTotal} end`));

  return rows
    .map((r) => ({
      ...r,
      pricePerDay: Number(r.pricePerDay),
      recentBookings: Number(r.recentBookings),
      ratio: r.unitsTotal ? r.unitsAvailable / r.unitsTotal : 0,
    }))
    .filter((r) => r.ratio <= threshold);
}

/** Every model with its units, for the QR and handover sheets. */
export async function listVehiclesBasic() {
  return db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      name: vehicles.name,
      brand: vehicles.brand,
      segment: vehicles.segment,
      bodyType: vehicles.bodyType,
      seats: vehicles.seats,
      imageUrl: vehicles.imageUrl,
      pricePerDay: vehicles.pricePerDay,
      unitsTotal: vehicles.unitsTotal,
      location: vehicles.location,
    })
    .from(vehicles)
    .where(eq(vehicles.status, "available"))
    .orderBy(asc(vehicles.name));
}
