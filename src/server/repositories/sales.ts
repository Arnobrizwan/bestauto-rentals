import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, customers, leads, vehicles } from "@/server/db/schema";

import type { Range } from "./analytics";

const withinRange = (r: Range) => and(gte(bookings.createdAt, r.from), lte(bookings.createdAt, r.to));

const bookingSelect = {
  id: bookings.id,
  reference: bookings.reference,
  status: bookings.status,
  createdAt: bookings.createdAt,
  pickupAt: bookings.pickupAt,
  dropoffAt: bookings.dropoffAt,
  days: bookings.days,
  subtotal: sql<number>`${bookings.subtotal}::float8`,
  extrasTotal: sql<number>`${bookings.extrasTotal}::float8`,
  total: sql<number>`${bookings.total}::float8`,
  paymentMethod: bookings.paymentMethod,
  couponCode: bookings.couponCode,
  couponDiscount: sql<number>`${bookings.couponDiscount}::float8`,
  pickupLocation: bookings.pickupLocation,
  customerName: customers.name,
  customerEmail: customers.email,
  customerPhone: customers.phone,
  vehicleName: vehicles.name,
  vehicleSlug: vehicles.slug,
};

const numeric = <T extends { subtotal: number; extrasTotal: number; total: number }>(r: T) => ({
  ...r,
  subtotal: Number(r.subtotal),
  extrasTotal: Number(r.extrasTotal),
  total: Number(r.total),
});

/* --------------------------------------------------------------- Invoices */

/**
 * Every confirmed booking is an invoice.
 *
 * There is no separate invoices table on purpose: an invoice here is a view of
 * a booking, not a second record that could disagree with it. VAT is shown as
 * the 15 % component already inside the total rather than added on top, which
 * is how a Bangladeshi VAT challan reads.
 */
export const VAT_RATE = 0.15;

export async function listInvoices(range: Range, opts: { q?: string; method?: string } = {}) {
  const clauses = [withinRange(range), eq(bookings.status, "success")];
  if (opts.method && opts.method !== "all") clauses.push(eq(bookings.paymentMethod, opts.method));
  if (opts.q) {
    const like = `%${opts.q.toLowerCase()}%`;
    clauses.push(sql`(lower(${bookings.reference}) like ${like} or lower(${customers.name}) like ${like})`);
  }

  const rows = await db
    .select(bookingSelect)
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(and(...clauses))
    .orderBy(desc(bookings.createdAt))
    .limit(200);

  return rows.map((r) => {
    const total = Number(r.total);
    const vat = total - total / (1 + VAT_RATE);
    return { ...numeric(r), vat, net: total - vat };
  });
}

export async function getPaymentMethods() {
  const rows = await db
    .selectDistinct({ method: bookings.paymentMethod })
    .from(bookings)
    .orderBy(bookings.paymentMethod);
  return rows.map((r) => r.method);
}

/** Revenue split by the rail it arrived on — bKash, Nagad, card, cash. */
export async function getPaymentMix(range: Range) {
  const rows = await db
    .select({
      method: bookings.paymentMethod,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
      avgValue: sql<number>`coalesce(avg(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .where(and(withinRange(range), eq(bookings.status, "success")))
    .groupBy(bookings.paymentMethod)
    .orderBy(desc(sql`sum(${bookings.total}::numeric)`));

  return rows.map((r) => ({ ...r, revenue: Number(r.revenue), avgValue: Number(r.avgValue) }));
}

/* ---------------------------------------------------- Cancellations */

/**
 * Cancelled bookings and what they cost.
 *
 * The refund ladder mirrors the published policy: cancel more than 48 hours
 * before pickup and the deposit is returned in full; inside 48 hours half is
 * retained; a no-show retains it all. Computing it here rather than storing it
 * means the board reflects the current policy, not the one in force when the
 * row was written.
 */
export function refundFor(total: number, createdAt: Date, pickupAt: Date) {
  const hoursNotice = (pickupAt.getTime() - createdAt.getTime()) / 3_600_000;
  if (hoursNotice >= 48) return { rate: 1, refund: total, retained: 0, band: "full refund" as const };
  if (hoursNotice >= 0) return { rate: 0.5, refund: total * 0.5, retained: total * 0.5, band: "50% retained" as const };
  return { rate: 0, refund: 0, retained: total, band: "no-show" as const };
}

export async function listCancellations(range: Range) {
  const rows = await db
    .select(bookingSelect)
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(and(withinRange(range), eq(bookings.status, "cancelled")))
    .orderBy(desc(bookings.createdAt))
    .limit(200);

  return rows.map((r) => {
    const row = numeric(r);
    return { ...row, ...refundFor(row.total, new Date(row.createdAt), new Date(row.pickupAt)) };
  });
}

/* ----------------------------------------------------------------- Quotes */

/**
 * Quotes are leads that carry enough detail to price.
 *
 * A lead with a budget, a party size or a named timeframe is a request for a
 * number; one without is still an enquiry. Splitting them here means the
 * quotes desk works a queue it can actually action, and the AI qualifier's
 * score decides the order.
 */
export async function listQuotes(opts: { status?: string } = {}) {
  const clauses = [sql`(${leads.budgetPerDay} is not null or ${leads.partySize} is not null)`];
  if (opts.status && opts.status !== "all") clauses.push(eq(leads.status, opts.status));

  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      company: leads.company,
      message: leads.message,
      intent: leads.intent,
      budgetPerDay: leads.budgetPerDay,
      partySize: leads.partySize,
      timeframe: leads.timeframe,
      score: leads.score,
      tier: leads.tier,
      status: leads.status,
      aiNextAction: leads.aiNextAction,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(and(...clauses))
    .orderBy(desc(leads.score), desc(leads.createdAt))
    .limit(200);

  return rows;
}

/**
 * Candidate vehicles for a quote: everything that seats the party and sits
 * inside the stated budget, cheapest first.
 */
export async function quoteCandidates(partySize: number | null, budgetPerDay: number | null) {
  const clauses = [eq(vehicles.status, "available")];
  if (partySize) clauses.push(gte(vehicles.seats, partySize));
  if (budgetPerDay) clauses.push(lte(sql`${vehicles.pricePerDay}::numeric`, budgetPerDay));

  return db
    .select({
      slug: vehicles.slug,
      name: vehicles.name,
      seats: vehicles.seats,
      pricePerDay: sql<number>`${vehicles.pricePerDay}::float8`,
      segment: vehicles.segment,
    })
    .from(vehicles)
    .where(and(...clauses))
    .orderBy(sql`${vehicles.pricePerDay}::numeric asc`)
    .limit(4);
}
