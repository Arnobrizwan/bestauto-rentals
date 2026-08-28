import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, customers, vehicles, type NewBooking } from "@/server/db/schema";

export type BookingFilters = {
  status?: string;
  q?: string;
  from?: Date;
  to?: Date;
  vehicleId?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "amount-desc" | "amount-asc";
};

export async function listBookings(f: BookingFilters = {}) {
  const clauses: SQL[] = [];
  if (f.status && f.status !== "all") clauses.push(eq(bookings.status, f.status));
  if (f.vehicleId) clauses.push(eq(bookings.vehicleId, f.vehicleId));
  if (f.from) clauses.push(gte(bookings.createdAt, f.from));
  if (f.to) clauses.push(lte(bookings.createdAt, f.to));
  if (f.q) {
    const needle = `%${f.q}%`;
    const q = or(
      ilike(bookings.reference, needle),
      ilike(customers.name, needle),
      ilike(customers.email, needle),
      ilike(vehicles.name, needle),
    );
    if (q) clauses.push(q);
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 10));

  const orderBy =
    f.sort === "oldest"
      ? bookings.createdAt
      : f.sort === "amount-desc"
        ? desc(sql`${bookings.total}::numeric`)
        : f.sort === "amount-asc"
          ? sql`${bookings.total}::numeric`
          : desc(bookings.createdAt);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        total: bookings.total,
        subtotal: bookings.subtotal,
        extrasTotal: bookings.extrasTotal,
        days: bookings.days,
        extras: bookings.extras,
        paymentMethod: bookings.paymentMethod,
        source: bookings.source,
        pickupLocation: bookings.pickupLocation,
        dropoffLocation: bookings.dropoffLocation,
        pickupAt: bookings.pickupAt,
        dropoffAt: bookings.dropoffAt,
        createdAt: bookings.createdAt,
        vehicleId: vehicles.id,
        vehicleName: vehicles.name,
        vehicleImage: vehicles.imageUrl,
        vehicleSlug: vehicles.slug,
        customerId: customers.id,
        customerName: customers.name,
        customerEmail: customers.email,
        customerCountry: customers.country,
      })
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: count() })
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .innerJoin(customers, eq(customers.id, bookings.customerId))
      .where(where),
  ]);

  const total = totalRow[0]?.n ?? 0;
  return {
    items: rows.map((r) => ({
      ...r,
      total: Number(r.total),
      subtotal: Number(r.subtotal),
      extrasTotal: Number(r.extrasTotal),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBookingByReference(reference: string) {
  const [row] = await db
    .select({
      booking: bookings,
      vehicle: vehicles,
      customer: customers,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(eq(bookings.reference, reference))
    .limit(1);
  return row ?? null;
}

export async function insertBooking(row: NewBooking) {
  const [created] = await db.insert(bookings).values(row).returning();
  return created;
}

export async function updateBookingStatus(id: string, status: string) {
  const [row] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
  return row ?? null;
}

/** Units already committed for a vehicle over a candidate window. */
export async function countOverlapping(vehicleId: string, pickupAt: Date, dropoffAt: Date) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.vehicleId, vehicleId),
        sql`${bookings.status} <> 'cancelled'`,
        lte(bookings.pickupAt, dropoffAt),
        gte(bookings.dropoffAt, pickupAt),
      ),
    );
  return row?.n ?? 0;
}
