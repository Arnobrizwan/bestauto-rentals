import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db/client";
import { leads, type NewLead } from "@/server/db/schema";

export async function insertLead(row: NewLead) {
  const [created] = await db.insert(leads).values(row).returning();
  return created;
}

export async function listLeads(
  opts: { tier?: string; status?: string; q?: string; from?: Date; to?: Date; page?: number; pageSize?: number } = {},
) {
  const clauses: SQL[] = [];
  if (opts.tier && opts.tier !== "all") clauses.push(eq(leads.tier, opts.tier));
  if (opts.status && opts.status !== "all") clauses.push(eq(leads.status, opts.status));
  if (opts.from) clauses.push(gte(leads.createdAt, opts.from));
  if (opts.to) clauses.push(lte(leads.createdAt, opts.to));
  if (opts.q) {
    const needle = `%${opts.q}%`;
    const q = or(ilike(leads.name, needle), ilike(leads.email, needle), ilike(leads.message, needle));
    if (q) clauses.push(q);
  }
  const where = clauses.length ? and(...clauses) : undefined;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 10));

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.score), desc(leads.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(leads).where(where),
  ]);

  const total = totalRow[0]?.n ?? 0;
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getLeadFunnel() {
  const rows = await db
    .select({
      tier: leads.tier,
      n: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(avg(${leads.score}), 0)::float8`,
    })
    .from(leads)
    .groupBy(leads.tier);
  return rows.map((r) => ({ ...r, avgScore: Number(r.avgScore) }));
}

export async function updateLeadStatus(id: string, status: string) {
  const [row] = await db.update(leads).set({ status }).where(eq(leads.id, id)).returning();
  return row ?? null;
}
