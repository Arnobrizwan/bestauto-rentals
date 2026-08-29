import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { ok, readJson, sanitizeText } from "@/lib/security/http";
import { createTestimonial, listTestimonials } from "@/server/repositories/testimonials";

export const dynamic = "force-dynamic";

/** Admin only: the public page reads the table directly, server-side. */
export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  return ok({ testimonials: await listTestimonials() });
}

const createSchema = z.object({
  author: z.string().min(2).max(80),
  city: z.string().max(80).optional(),
  // Half stars are real on this page — the design ships a 4.5.
  rating: z.coerce.number().min(1).max(5),
  body: z.string().min(20).max(600),
  vehicleSlug: z.string().max(120).optional(),
  active: z.coerce.boolean().optional(),
});

/**
 * Publishes a testimonial.
 *
 * The home page carousel was six objects in a TSX const, so adding what a
 * customer wrote last week — or taking down what one asked to have removed —
 * needed a developer and a deploy. The section is above the fold, so this
 * revalidates `/` rather than leaving it up to five minutes stale.
 */
export async function POST(req: Request) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const body = await readJson(req, createSchema, 16_000);
  if (!body.ok) return body.response;

  const created = await createTestimonial({
    id: `tst_${nanoid(10)}`,
    author: sanitizeText(body.data.author, 80),
    city: sanitizeText(body.data.city ?? "", 80),
    rating: body.data.rating,
    body: sanitizeText(body.data.body, 600),
    vehicleSlug: body.data.vehicleSlug ? sanitizeText(body.data.vehicleSlug, 120) : null,
    active: body.data.active ?? true,
  });

  revalidatePath("/");
  log.info("testimonial.created", { id: created.id, author: created.author });
  return ok({ testimonial: created }, { status: 201 });
}
