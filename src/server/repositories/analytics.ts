import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, customers, leads, vehicles } from "@/server/db/schema";

export type Range = { from: Date; to: Date };

export const DAY = 86_400_000;

export function resolveRange(preset?: string | null, from?: string | null, to?: string | null): Range {
  if (from && to) {
    const f = new Date(from);
    const t = new Date(to);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
      t.setHours(23, 59, 59, 999);
      return { from: f, to: t };
    }
  }
  const now = new Date();
  const to_ = new Date(now);
  to_.setHours(23, 59, 59, 999);
  const days =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "365d" ? 365 : 30;
  const from_ = new Date(now.getTime() - (days - 1) * DAY);
  from_.setHours(0, 0, 0, 0);
  return { from: from_, to: to_ };
}

const inRange = (r: Range) => and(gte(bookings.createdAt, r.from), lte(bookings.createdAt, r.to));
const successful = (r: Range) => and(inRange(r), eq(bookings.status, "success"));

/* ------------------------------------------------------------------ KPIs */

export async function getKpis(range: Range) {
  const span = range.to.getTime() - range.from.getTime();
  const prev: Range = { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime() - 1) };

  const totals = async (r: Range) => {
    const [row] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
        cost: sql<number>`coalesce(sum(${vehicles.costPerDay}::numeric * ${bookings.days}), 0)::float8`,
        orders: sql<number>`count(*)::int`,
        days: sql<number>`coalesce(sum(${bookings.days}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
      .where(successful(r));
    return row ?? { revenue: 0, cost: 0, orders: 0, days: 0 };
  };

  const countAll = async (r: Range) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(inRange(r));
    return row?.n ?? 0;
  };

  const newCustomers = async (r: Range) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(gte(customers.createdAt, r.from), lte(customers.createdAt, r.to)));
    return row?.n ?? 0;
  };

  const [cur, before, curAll, beforeAll, curCustomers, beforeCustomers, leadRow] = await Promise.all([
    totals(range),
    totals(prev),
    countAll(range),
    countAll(prev),
    newCustomers(range),
    newCustomers(prev),
    db
      .select({
        total: sql<number>`count(*)::int`,
        hot: sql<number>`count(*) filter (where ${leads.tier} = 'hot')::int`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, range.from), lte(leads.createdAt, range.to))),
  ]);

  const delta = (now: number, then: number) =>
    then === 0 ? (now === 0 ? 0 : 100) : ((now - then) / then) * 100;

  const conversion = curAll === 0 ? 0 : (cur.orders / curAll) * 100;
  const prevConversion = beforeAll === 0 ? 0 : (before.orders / beforeAll) * 100;

  return {
    revenue: { value: cur.revenue, delta: delta(cur.revenue, before.revenue) },
    margin: {
      value: cur.revenue - cur.cost,
      delta: delta(cur.revenue - cur.cost, before.revenue - before.cost),
    },
    bookings: { value: cur.orders, delta: delta(cur.orders, before.orders) },
    rentalDays: { value: cur.days, delta: delta(cur.days, before.days) },
    customers: { value: curCustomers, delta: delta(curCustomers, beforeCustomers) },
    conversion: { value: conversion, delta: conversion - prevConversion },
    averageOrder: {
      value: cur.orders ? cur.revenue / cur.orders : 0,
      delta: delta(cur.orders ? cur.revenue / cur.orders : 0, before.orders ? before.revenue / before.orders : 0),
    },
    leads: { value: leadRow[0]?.total ?? 0, hot: leadRow[0]?.hot ?? 0 },
  };
}

/* ------------------------------------------------- Sales analytics chart */

export type Grain = "day" | "week" | "month";

const GRAINS: Record<Grain, string> = { day: "day", week: "week", month: "month" };

export async function getSalesSeries(range: Range, grain: Grain = "month") {
  // The grain is interpolated as a literal, not bound: a bound parameter makes
  // the GROUP BY expression a different node from the projected one, and
  // Postgres rejects it (42803). GRAINS is a closed allow-list, so this cannot
  // carry user input into the statement.
  const bucketExpr = sql.raw(`date_trunc('${GRAINS[grain] ?? "month"}', "created_at")`);

  const rows = await db
    .select({
      bucket: sql<string>`to_char(${bucketExpr}, 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric) filter (where ${bookings.status} = 'success'), 0)::float8`,
      orders: sql<number>`count(*) filter (where ${bookings.status} = 'success')::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')::int`,
    })
    .from(bookings)
    .where(inRange(range))
    .groupBy(bucketExpr)
    .orderBy(bucketExpr);

  return rows.map((r) => ({
    bucket: r.bucket,
    label: formatBucket(r.bucket, grain),
    revenue: Number(r.revenue),
    orders: r.orders,
    cancelled: r.cancelled,
  }));
}

function formatBucket(iso: string, grain: Grain) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (grain === "month") return d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/* ------------------------------------------------------ Sales by country */

export async function getSalesByCountry(range: Range) {
  const rows = await db
    .select({
      country: customers.country,
      countryCode: customers.countryCode,
      sales: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(successful(range))
    .groupBy(customers.country, customers.countryCode)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
}

/* ---------------------------------------------------------- Best sellers */

export async function getBestSellers(range: Range, limit = 5) {
  const rows = await db
    .select({
      id: vehicles.id,
      name: vehicles.name,
      slug: vehicles.slug,
      imageUrl: vehicles.imageUrl,
      pricePerDay: vehicles.pricePerDay,
      sales: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(successful(range))
    .groupBy(vehicles.id, vehicles.name, vehicles.slug, vehicles.imageUrl, vehicles.pricePerDay)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({ ...r, revenue: Number(r.revenue), pricePerDay: Number(r.pricePerDay) }));
}

/* ------------------------------------------------------ Recent bookings */

export async function getRecentBookings(limit = 5) {
  const rows = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      total: bookings.total,
      paymentMethod: bookings.paymentMethod,
      createdAt: bookings.createdAt,
      vehicleName: vehicles.name,
      vehicleImage: vehicles.imageUrl,
      customerName: customers.name,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}

/* ------------------------------------------------- Fleet utilisation mix */

export async function getFleetUtilisation(range: Range) {
  const rows = await db
    .select({
      segment: vehicles.segment,
      rentalDays: sql<number>`coalesce(sum(${bookings.days}), 0)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
      units: sql<number>`0::int`,
    })
    .from(bookings)
    .innerJoin(vehicles, eq(vehicles.id, bookings.vehicleId))
    .where(successful(range))
    .groupBy(vehicles.segment);

  const capacity = await db
    .select({ segment: vehicles.segment, units: sql<number>`coalesce(sum(${vehicles.unitsTotal}), 0)::int` })
    .from(vehicles)
    .groupBy(vehicles.segment);

  const capacityBySegment = new Map(capacity.map((c) => [c.segment, c.units]));
  const spanDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY));

  return rows.map((r) => {
    const units = capacityBySegment.get(r.segment) ?? 0;
    const available = units * spanDays;
    return {
      segment: r.segment,
      rentalDays: r.rentalDays,
      revenue: Number(r.revenue),
      units,
      utilisation: available ? Math.min(100, (r.rentalDays / available) * 100) : 0,
    };
  });
}

/* --------------------------------------------------- Booking status mix */

export async function getStatusMix(range: Range) {
  const rows = await db
    .select({ status: bookings.status, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(inRange(range))
    .groupBy(bookings.status);
  return rows;
}

/* --------------------------------------------------- Acquisition source */

export async function getSourceMix(range: Range) {
  const rows = await db
    .select({
      source: bookings.source,
      n: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${bookings.total}::numeric), 0)::float8`,
    })
    .from(bookings)
    .where(successful(range))
    .groupBy(bookings.source)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
}
