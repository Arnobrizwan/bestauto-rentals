import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/server";
import { log } from "@/lib/observability/logger";
import { fail, ok, readJson } from "@/lib/security/http";
import { getBookingByReference } from "@/server/repositories/bookings";
import { BookingError, setBookingStatus } from "@/server/services/bookings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const row = await getBookingByReference(reference);
  if (!row) return fail(404, "Booking not found.");

  return ok({
    booking: { ...row.booking, total: Number(row.booking.total), subtotal: Number(row.booking.subtotal) },
    vehicle: { ...row.vehicle, pricePerDay: Number(row.vehicle.pricePerDay), costPerDay: undefined },
    customer: { name: row.customer.name, email: row.customer.email, city: row.customer.city },
  });
}

const patchSchema = z.object({ status: z.enum(["pending", "success", "cancelled"]) });

/**
 * Confirms or cancels a booking.
 *
 * This route was GET-only, so nothing in the product could change a booking's
 * status — and `cancelBooking` sat in the service layer with zero callers,
 * which meant the shipped "Cancellation recovery" automation listened for a
 * `booking.cancelled` event that could never be emitted. The rule was a row in
 * a table pretending to be a feature.
 *
 * Cancelling now fires that event and gives the held unit back, because the
 * inventory rule that takes one on creation has no counterpart — without the
 * release, stock stayed down forever on a booking that no longer exists.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const forbidden = await requireAdmin({ role: "admin" });
  if (forbidden) return forbidden;

  const { reference } = await params;
  const body = await readJson(req, patchSchema, 4_000);
  if (!body.ok) return body.response;

  try {
    const result = await setBookingStatus(reference, body.data.status);

    // The car's own page too — it is the page a customer books from, and it
    // carries the scarcity badge. Revalidating only the listing left the
    // detail page claiming "Last one available" for up to five minutes after
    // the unit came back.
    revalidatePath("/");
    revalidatePath("/cars");
    revalidatePath(`/cars/${result.slug}`);

    log.info("booking.status", { reference, status: body.data.status, released: result.released });
    return ok({
      booking: { ...result.booking, total: Number(result.booking.total) },
      automationRuns: result.automation?.length ?? 0,
    });
  } catch (err) {
    if (err instanceof BookingError) return fail(err.status, err.message);
    throw err;
  }
}
