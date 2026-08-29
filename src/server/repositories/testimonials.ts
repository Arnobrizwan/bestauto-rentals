import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { testimonials, type NewTestimonial } from "@/server/db/schema";

/**
 * What the home page shows.
 *
 * Ordered oldest first so the carousel keeps the order the hardcoded array
 * had — the seed carries the original six across in their original sequence,
 * and a page of testimonials that reshuffles itself on every deploy reads as
 * broken rather than fresh.
 */
export async function listActiveTestimonials(limit = 12) {
  return db
    .select({
      id: testimonials.id,
      author: testimonials.author,
      city: testimonials.city,
      rating: testimonials.rating,
      body: testimonials.body,
      vehicleSlug: testimonials.vehicleSlug,
    })
    .from(testimonials)
    .where(eq(testimonials.active, true))
    .orderBy(asc(testimonials.createdAt))
    .limit(limit);
}

/** The operator's view: everything, including what has been taken down. */
export async function listTestimonials() {
  return db.select().from(testimonials).orderBy(desc(testimonials.createdAt));
}

export async function createTestimonial(row: NewTestimonial) {
  const [created] = await db.insert(testimonials).values(row).returning();
  return created;
}

export async function updateTestimonial(id: string, patch: Partial<NewTestimonial>) {
  const [row] = await db.update(testimonials).set(patch).where(eq(testimonials.id, id)).returning();
  return row ?? null;
}

export async function deleteTestimonial(id: string) {
  const [row] = await db.delete(testimonials).where(eq(testimonials.id, id)).returning();
  return row ?? null;
}
