import { and, asc, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";

import { BRANCHES } from "@/lib/taxonomy";
import { countOverlapping } from "@/server/repositories/bookings";
import { db } from "@/server/db/client";
import { bookings, vehicles, type Vehicle } from "@/server/db/schema";

export type VehicleFilters = {
  segment?: string;
  brand?: string;
  bodyType?: string;
  transmission?: string;
  fuel?: string;
  seatsMin?: number;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  q?: string;
  /** Both required together: only vehicles with a unit free across the range. */
  availableFrom?: Date;
  availableTo?: Date;
  sort?: "popular" | "price-asc" | "price-desc" | "rating" | "newest";
  limit?: number;
  offset?: number;
};

/** `unitsFree` is availability over the requested window — today, when none was given. */
export type VehicleWithStats = Vehicle & { bookingCount: number; revenue: number; unitsFree: number };

function buildWhere(f: VehicleFilters): SQL | undefined {
  const clauses: SQL[] = [];
  // "popular" is a sort, not a stored category — the Figma tab maps to ranking.
  if (f.segment && f.segment !== "all" && f.segment !== "popular") {
    clauses.push(eq(vehicles.segment, f.segment));
  }
  if (f.brand) clauses.push(eq(vehicles.brand, f.brand));
  if (f.bodyType) clauses.push(eq(vehicles.bodyType, f.bodyType));
  if (f.transmission) clauses.push(eq(vehicles.transmission, f.transmission));
  if (f.fuel) clauses.push(eq(vehicles.fuel, f.fuel));
  if (f.seatsMin) clauses.push(gte(vehicles.seats, f.seatsMin));
  if (f.priceMin !== undefined) clauses.push(gte(sql`${vehicles.pricePerDay}::numeric`, f.priceMin));
  if (f.priceMax !== undefined) clauses.push(lte(sql`${vehicles.pricePerDay}::numeric`, f.priceMax));
  // Matched as a prefix, not an exact string. Branches are named "Dhaka
  // Gulshan", "Dhaka Banani" and so on, so an exact match meant a request for
  // "Dhaka" — which is how customers and models alike refer to the city —
  // matched nothing at all and read as "no cars in Dhaka".
  if (f.location) clauses.push(ilike(vehicles.location, `${f.location}%`));
  if (f.q) {
    const needle = `%${f.q.toLowerCase()}%`;
    clauses.push(
      sql`(lower(${vehicles.name}) like ${needle} or lower(${vehicles.brand}) like ${needle} or lower(${vehicles.bodyType}) like ${needle})`,
    );
  }

  // Real availability, not just "is it in the catalogue".
  //
  // The fleet page displayed the dates the visitor searched and then listed
  // every car regardless of them, so a car already booked out for those days
  // sat there looking bookable. A model is offered only while at least one of
  // its units is free for the whole range — the same overlap test the booking
  // service uses, so the list and the checkout cannot disagree.
  if (f.availableFrom && f.availableTo) {
    clauses.push(sql`${vehicles.unitsTotal} > (
      select count(*) from ${bookings}
      where ${bookings.vehicleId} = ${vehicles.id}
        and ${bookings.status} <> 'cancelled'
        and ${bookings.pickupAt} <= ${f.availableTo}
        and ${bookings.dropoffAt} >= ${f.availableFrom}
    )`);
  }

  return clauses.length ? and(...clauses) : undefined;
}

/** Booking counts per vehicle, used both for ranking and for the admin table. */
async function statsByVehicle() {
  const rows = await db
    .select({
      vehicleId: bookings.vehicleId,
      bookingCount: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .where(eq(bookings.status, "success"))
    .groupBy(bookings.vehicleId);

  return new Map(rows.map((r) => [r.vehicleId, r]));
}

export async function listVehicles(f: VehicleFilters = {}) {
  const where = buildWhere(f);

  const orderBy =
    f.sort === "price-asc"
      ? [asc(sql`${vehicles.pricePerDay}::numeric`)]
      : f.sort === "price-desc"
        ? [desc(sql`${vehicles.pricePerDay}::numeric`)]
        : f.sort === "rating"
          ? [desc(vehicles.rating)]
          : f.sort === "newest"
            ? [desc(vehicles.year), desc(vehicles.createdAt)]
            : [desc(vehicles.rating)];

  /*
   * Units genuinely free, for the window being asked about.
   *
   * Availability had two answers. The public scarcity badge read
   * `unitsAvailable`, a running counter the automation engine decrements on
   * every booking; the booking guard counted bookings that actually overlap
   * the requested dates. They disagree constantly — a car fully booked next
   * week reads "3 available" today, and a car whose counter is exhausted by
   * bookings in December is refused for a hire in March.
   *
   * The date-aware count is the one that can be checked against reality, so it
   * is the only one the site quotes now. With no dates in play the window is
   * today, which makes "last one available" a claim about right now rather
   * than an unverifiable number.
   */
  const from = f.availableFrom ?? new Date();
  const to = f.availableTo ?? new Date();

  const overlapping = db
    .select({ n: sql<number>`count(*)` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vehicleId, vehicles.id),
        sql`${bookings.status} <> 'cancelled'`,
        lte(bookings.pickupAt, to),
        gte(bookings.dropoffAt, from),
      ),
    );

  const freeUnits = sql<number>`greatest(0, ${vehicles.unitsTotal} - (${overlapping}))::int`;

  const [rows, stats, totalRow] = await Promise.all([
    db.select({ vehicle: vehicles, unitsFree: freeUnits }).from(vehicles).where(where).orderBy(...orderBy),
    statsByVehicle(),
    db.select({ count: sql<number>`count(*)::int` }).from(vehicles).where(where),
  ]);

  let enriched: VehicleWithStats[] = rows.map((r) => ({
    ...r.vehicle,
    unitsFree: Number(r.unitsFree),
    bookingCount: stats.get(r.vehicle.id)?.bookingCount ?? 0,
    revenue: stats.get(r.vehicle.id)?.revenue ?? 0,
  }));

  // Popularity ordering needs the aggregate, so it is applied after the join.
  if (f.sort === "popular" || f.segment === "popular" || !f.sort) {
    enriched = enriched.sort((a, b) => b.bookingCount - a.bookingCount || b.rating - a.rating);
  }

  const total = totalRow[0]?.count ?? enriched.length;
  const offset = f.offset ?? 0;
  const limit = f.limit ?? enriched.length;

  return { items: enriched.slice(offset, offset + limit), total };
}

export async function getVehicleBySlug(slug: string) {
  const [row] = await db.select().from(vehicles).where(eq(vehicles.slug, slug)).limit(1);
  return row ?? null;
}

export async function getVehicleById(id: string) {
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return row ?? null;
}

export async function getVehiclesByIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(vehicles).where(inArray(vehicles.id, ids));
}

/**
 * Every branch we operate, not just the ones a vehicle currently calls home.
 * A customer can collect any car from any branch, so the filter and the search
 * panel must offer all of them.
 */
/** Re-exported from the shared vocabulary so existing imports keep working. */
export { BRANCHES };

export async function listFacets() {
  const rows = await db.select().from(vehicles);
  const uniq = <T,>(xs: T[]) => [...new Set(xs)].sort();
  const prices = rows.map((r) => Number(r.pricePerDay));
  return {
    brands: uniq(rows.map((r) => r.brand)),
    bodyTypes: uniq(rows.map((r) => r.bodyType)),
    transmissions: uniq(rows.map((r) => r.transmission)),
    fuels: uniq(rows.map((r) => r.fuel)),
    locations: uniq([...BRANCHES, ...rows.map((r) => r.location)]),
    segments: uniq(rows.map((r) => r.segment)),
    // Numeric sort: the generic helper sorts lexicographically, which puts 11 before 5.
    seats: [...new Set(rows.map((r) => r.seats))].sort((a, b) => a - b),
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : 0,
    count: rows.length,
  };
}

export async function adjustAvailability(vehicleId: string, delta: number) {
  await db
    .update(vehicles)
    .set({
      unitsAvailable: sql`greatest(0, least(${vehicles.unitsTotal}, ${vehicles.unitsAvailable} + ${delta}))`,
    })
    .where(eq(vehicles.id, vehicleId));
}

/** Inserts a new model. The slug is unique, so a repeat returns null. */
export async function insertVehicle(row: typeof vehicles.$inferInsert) {
  const [created] = await db.insert(vehicles).values(row).onConflictDoNothing().returning();
  return created ?? null;
}

/**
 * Edits a vehicle in place.
 *
 * The fleet was add-only: `/api/vehicles/[slug]` exported GET and nothing
 * else, so a typo in a name or a wrong daily rate was permanent and public,
 * and a car could never be retired. Only the columns supplied are written, so
 * a partial edit cannot blank the fields it did not mention.
 */
export async function updateVehicle(slug: string, patch: Partial<typeof vehicles.$inferInsert>) {
  const [row] = await db.update(vehicles).set(patch).where(eq(vehicles.slug, slug)).returning();
  return row ?? null;
}

/**
 * Retires a vehicle.
 *
 * Refused while any booking still references it, rather than cascading: a
 * booking whose vehicle has vanished cannot be priced, invoiced or handed
 * over, and the customer's confirmation page would break. Taking the units to
 * zero is the way to stop new bookings on a car with history.
 */
export async function deleteVehicle(slug: string) {
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return { ok: false as const, reason: "not-found" as const };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.vehicleId, vehicle.id));

  if (n > 0) return { ok: false as const, reason: "has-bookings" as const, bookings: n };

  await db.delete(vehicles).where(eq(vehicles.slug, slug));
  return { ok: true as const, name: vehicle.name };
}

/**
 * Units of one vehicle free across a window — today, when none is given.
 *
 * The single definition of "available" the whole site quotes: the same overlap
 * test the booking guard applies, so the badge on a car's page and the answer
 * at checkout can never contradict each other.
 */
export async function countFreeUnits(vehicleId: string, from = new Date(), to = new Date()) {
  const [row] = await db
    .select({ total: vehicles.unitsTotal })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);
  if (!row) return 0;

  // The guard's own counter, not a second hand-written copy of its predicate.
  // Two fragments that only look identical is how the site ended up quoting
  // one availability and enforcing another.
  const taken = await countOverlapping(vehicleId, from, to);
  return Math.max(0, row.total - taken);
}
