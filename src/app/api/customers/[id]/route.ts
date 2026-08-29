import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson, sanitizeText } from "@/lib/security/http";
import { updateCustomer } from "@/server/repositories/customers";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    // Bangladeshi mobile numbers are written a dozen ways — +8801, 8801, 01 —
    // and a customer abroad has a different shape again, so this is length
    // bounded rather than pattern matched. Rejecting a real number the counter
    // needs to dial is the worse failure.
    phone: z.string().max(40),
    city: z.string().max(120),
  })
  .partial();

/**
 * Corrects a customer's contact details.
 *
 * The customers board ranked people by lifetime value and could change nothing
 * about them: a transposed digit in the phone number stayed wrong, and it is
 * the number the counter rings when a flight lands early. Nothing public reads
 * this row, so there is nothing to revalidate — the dashboard is dynamic.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await readJson(req, schema, 8_000);
  if (!body.ok) return body.response;
  if (!Object.keys(body.data).length) return fail(400, "Nothing to update.");

  const { name, email, phone, city } = body.data;
  const result = await updateCustomer(id, {
    ...(name !== undefined ? { name: sanitizeText(name, 120) } : {}),
    ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
    ...(phone !== undefined ? { phone: sanitizeText(phone, 40) } : {}),
    ...(city !== undefined ? { city: sanitizeText(city, 120) } : {}),
  });

  if (!result.ok && result.reason === "not-found") return fail(404, "Customer not found.");
  if (!result.ok) return fail(409, "Another customer already uses that email address.");

  log.info("customer.updated", { id, fields: Object.keys(body.data) });
  return ok({ customer: result.customer });
}
