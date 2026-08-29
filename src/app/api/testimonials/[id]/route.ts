import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson, sanitizeText } from "@/lib/security/http";
import { deleteTestimonial, updateTestimonial } from "@/server/repositories/testimonials";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    author: z.string().min(2).max(80),
    city: z.string().max(80),
    rating: z.coerce.number().min(1).max(5),
    body: z.string().min(20).max(600),
    vehicleSlug: z.string().max(120).nullable(),
    active: z.boolean(),
  })
  .partial();

/** Edit a review, or take it off the home page with `active: false`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, patchSchema, 16_000);
  if (!body.ok) return body.response;
  if (!Object.keys(body.data).length) return fail(400, "Nothing to update.");

  const { author, city, body: text, vehicleSlug, ...rest } = body.data;
  const updated = await updateTestimonial(id, {
    ...rest,
    ...(author !== undefined ? { author: sanitizeText(author, 80) } : {}),
    ...(city !== undefined ? { city: sanitizeText(city, 80) } : {}),
    ...(text !== undefined ? { body: sanitizeText(text, 600) } : {}),
    ...(vehicleSlug !== undefined
      ? { vehicleSlug: vehicleSlug ? sanitizeText(vehicleSlug, 120) : null }
      : {}),
  });
  if (!updated) return fail(404, "Testimonial not found.");

  revalidatePath("/");
  log.info("testimonial.updated", { id, fields: Object.keys(body.data) });
  return ok({ testimonial: updated });
}

/**
 * Deletes a review outright.
 *
 * Unlike a coupon, nothing downstream records which testimonial it was priced
 * with, so there is no history to orphan. Taking one down without losing it is
 * what `active: false` is for; this is for the ones that should never have
 * been published — a duplicate, or something posted in error.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const removed = await deleteTestimonial(id);
  if (!removed) return fail(404, "Testimonial not found.");

  revalidatePath("/");
  log.info("testimonial.removed", { id, author: removed.author });
  return ok({ id: removed.id, author: removed.author });
}
