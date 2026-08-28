import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, customers, vehicles } from "@/server/db/schema";

import { DAY } from "./analytics";

/** A day in the availability grid: how many units of a model are committed. */
export type AvailabilityCell = { date: string; committed: number; free: number };

export type VehicleAvailability = {
  id: string;
  slug: string;
  name: string;
  segment: string;
  location: string;
  unitsTotal: number;
  /** Units on hire at this moment. */
  onHireNow: number;
  /** The worst day in the window — the peak commitment against the fleet. */
  peakCommitted: number;
  /** True when at least one day in the window is fully booked out. */
  soldOut: boolean;
  days: AvailabilityCell[];
};

const midnight = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Day-by-day availability for every model over a forward window.
 *
 * Overlap is computed in JavaScript rather than SQL on purpose: the query
 * returns only the bookings that intersect the window (a small set even on a
 * busy fleet), and building the grid here keeps the date arithmetic in one
 * readable place instead of a generate_series join that has to repeat the
 * half-open interval rule in three conditions.
 */
export async function getFleetAvailability(windowDays = 14): Promise<VehicleAvailability[]> {
  const start = midnight(new Date());
  const end = new Date(start.getTime() + (windowDays - 1) * DAY);
  end.setHours(23, 59, 59, 999);

  const fleet = await db
    .select({
      id: vehicles.id,
      slug: vehicles.slug,
      name: vehicles.name,
      segment: vehicles.segment,
      location: vehicles.location,
      unitsTotal: vehicles.unitsTotal,
    })
    .from(vehicles)
    .orderBy(asc(vehicles.name));

  // A booking occupies the fleet from pickup to dropoff inclusive, so it
  // intersects the window whenever it starts before the window ends and ends
  // after the window starts.
  const overlapping = await db
    .select({
      vehicleId: bookings.vehicleId,
      pickupAt: bookings.pickupAt,
      dropoffAt: bookings.dropoffAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "success"),
        lte(bookings.pickupAt, end),
        gte(bookings.dropoffAt, start),
      ),
    );

  const byVehicle = new Map<string, { pickupAt: Date; dropoffAt: Date }[]>();
  for (const b of overlapping) {
    const list = byVehicle.get(b.vehicleId);
    const row = { pickupAt: new Date(b.pickupAt), dropoffAt: new Date(b.dropoffAt) };
    if (list) list.push(row);
    else byVehicle.set(b.vehicleId, [row]);
  }

  const now = Date.now();

  return fleet.map((v) => {
    const held = byVehicle.get(v.id) ?? [];

    const days: AvailabilityCell[] = [];
    for (let i = 0; i < windowDays; i += 1) {
      const dayStart = new Date(start.getTime() + i * DAY);
      const dayEnd = new Date(dayStart.getTime() + DAY - 1);
      const committed = held.filter(
        (h) => h.pickupAt.getTime() <= dayEnd.getTime() && h.dropoffAt.getTime() >= dayStart.getTime(),
      ).length;
      days.push({
        date: isoDay(dayStart),
        committed,
        free: Math.max(0, v.unitsTotal - committed),
      });
    }

    const onHireNow = held.filter(
      (h) => h.pickupAt.getTime() <= now && h.dropoffAt.getTime() >= now,
    ).length;

    const peakCommitted = days.reduce((max, d) => Math.max(max, d.committed), 0);

    return {
      ...v,
      onHireNow: Math.min(onHireNow, v.unitsTotal),
      peakCommitted,
      soldOut: days.some((d) => d.free === 0),
      days,
    };
  });
}

/** Handovers and returns due in the next `days` days, for the counter desk. */
export async function getMovements(days = 7) {
  const start = midnight(new Date());
  const end = new Date(start.getTime() + days * DAY);

  const select = {
    reference: bookings.reference,
    vehicleName: vehicles.name,
    customerName: customers.name,
    customerPhone: customers.phone,
    pickupLocation: bookings.pickupLocation,
    dropoffLocation: bookings.dropoffLocation,
    pickupAt: bookings.pickupAt,
    dropoffAt: bookings.dropoffAt,
    total: sql<number>`${bookings.total}::float8`,
  };

  const [pickups, returns] = await Promise.all([
    db
      .select(select)
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(and(eq(bookings.status, "success"), gte(bookings.pickupAt, start), lte(bookings.pickupAt, end)))
      .orderBy(asc(bookings.pickupAt))
      .limit(50),
    db
      .select(select)
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(and(eq(bookings.status, "success"), gte(bookings.dropoffAt, start), lte(bookings.dropoffAt, end)))
      .orderBy(asc(bookings.dropoffAt))
      .limit(50),
  ]);

  return {
    pickups: pickups.map((p) => ({ ...p, total: Number(p.total) })),
    returns: returns.map((r) => ({ ...r, total: Number(r.total) })),
  };
}
