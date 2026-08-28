import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db/client";
import { bookings, customers } from "@/server/db/schema";

export async function upsertCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  countryCode?: string;
}) {
  const [existing] = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  if (existing) return existing;

  const id = `cus_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const [created] = await db
    .insert(customers)
    .values({
      id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      city: input.city ?? "",
      country: input.country ?? "United Kingdom",
      countryCode: input.countryCode ?? "826",
      avatarSeed: input.name,
    })
    .returning();
  return created;
}

export async function listCustomers(opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const clauses: SQL[] = [];
  if (opts.q) {
    const needle = `%${opts.q}%`;
    const q = or(ilike(customers.name, needle), ilike(customers.email, needle), ilike(customers.city, needle));
    if (q) clauses.push(q);
  }
  const where = clauses.length ? and(...clauses) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 10));

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        city: customers.city,
        country: customers.country,
        countryCode: customers.countryCode,
        createdAt: customers.createdAt,
        bookingCount: sql<number>`count(${bookings.id})::int`,
        lifetimeValue: sql<number>`coalesce(sum(${bookings.total}::numeric) filter (where ${bookings.status} = 'success'), 0)::float8`,
        lastBookingAt: sql<Date | null>`max(${bookings.createdAt})`,
      })
      .from(customers)
      .leftJoin(bookings, eq(bookings.customerId, customers.id))
      .where(where)
      .groupBy(customers.id)
      .orderBy(desc(sql`coalesce(sum(${bookings.total}::numeric) filter (where ${bookings.status} = 'success'), 0)`))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(customers).where(where),
  ]);

  const total = totalRow[0]?.n ?? 0;
  return {
    items: rows.map((r) => ({ ...r, lifetimeValue: Number(r.lifetimeValue) })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
