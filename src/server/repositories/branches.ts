import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, vehicles } from "@/server/db/schema";

import type { Range } from "./analytics";
import { BRANCHES } from "./vehicles";

export type BranchFlow = {
  branch: string;
  /** Cars collected here. */
  pickups: number;
  /** Cars returned here. */
  dropoffs: number;
  /** dropoffs − pickups. Positive means cars pile up and need moving back. */
  net: number;
  /** One-way hires that started here. */
  oneWayOut: number;
  revenue: number;
  /** Vehicles whose home branch this is. */
  homeFleet: number;
};

/**
 * Where the fleet actually ends up.
 *
 * A one-way hire from Dhaka to Cox's Bazar leaves a car at the coast that
 * somebody has to drive back, and that repositioning cost is invisible on a
 * revenue-only view. Counting pickups against dropoffs per branch surfaces it:
 * a positive `net` is a branch accumulating cars it did not rent out.
 */
export async function getBranchFlow(range: Range): Promise<BranchFlow[]> {
  const inRange = and(
    eq(bookings.status, "success"),
    gte(bookings.createdAt, range.from),
    lte(bookings.createdAt, range.to),
  );

  const [pickupRows, dropoffRows, oneWayRows, homeRows] = await Promise.all([
    db
      .select({
        branch: bookings.pickupLocation,
        n: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
      })
      .from(bookings)
      .where(inRange)
      .groupBy(bookings.pickupLocation),
    db
      .select({ branch: bookings.dropoffLocation, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(inRange)
      .groupBy(bookings.dropoffLocation),
    db
      .select({ branch: bookings.pickupLocation, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(inRange, sql`${bookings.pickupLocation} <> ${bookings.dropoffLocation}`))
      .groupBy(bookings.pickupLocation),
    db
      .select({ branch: vehicles.location, n: sql<number>`coalesce(sum(${vehicles.unitsTotal}), 0)::int` })
      .from(vehicles)
      .groupBy(vehicles.location),
  ]);

  const pickupBy = new Map(pickupRows.map((r) => [r.branch, r]));
  const dropoffBy = new Map(dropoffRows.map((r) => [r.branch, r.n]));
  const oneWayBy = new Map(oneWayRows.map((r) => [r.branch, r.n]));
  const homeBy = new Map(homeRows.map((r) => [r.branch, r.n]));

  // Drive the list from the branch catalogue, not from the bookings, so a
  // branch with no movement in the period still shows as a zero row rather
  // than silently disappearing from the table.
  return BRANCHES.map((branch) => {
    const pickup = pickupBy.get(branch);
    const pickups = pickup?.n ?? 0;
    const dropoffs = dropoffBy.get(branch) ?? 0;
    return {
      branch,
      pickups,
      dropoffs,
      net: dropoffs - pickups,
      oneWayOut: oneWayBy.get(branch) ?? 0,
      revenue: Number(pickup?.revenue ?? 0),
      homeFleet: homeBy.get(branch) ?? 0,
    };
  }).sort((a, b) => b.pickups - a.pickups);
}

/** The busiest one-way corridors, which is what a repositioning run follows. */
export async function getOneWayCorridors(range: Range, limit = 8) {
  const rows = await db
    .select({
      from: bookings.pickupLocation,
      to: bookings.dropoffLocation,
      n: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "success"),
        gte(bookings.createdAt, range.from),
        lte(bookings.createdAt, range.to),
        sql`${bookings.pickupLocation} <> ${bookings.dropoffLocation}`,
      ),
    )
    .groupBy(bookings.pickupLocation, bookings.dropoffLocation)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
}
