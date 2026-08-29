import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, guard, ok, readJson } from "@/lib/security/http";
import { listBookings } from "@/server/repositories/bookings";
import { BookingError, createBooking } from "@/server/services/bookings";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vehicleSlug: z.string().min(1).max(120),
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(200),
    phone: z.string().max(40).optional(),
    city: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
  }),
  pickupLocation: z.string().min(2).max(120),
  dropoffLocation: z.string().max(120).optional(),
  pickupAt: z.string().min(8).max(40),
  dropoffAt: z.string().min(8).max(40),
  extras: z.array(z.string().max(60)).max(6).optional(),
  paymentMethod: z.string().max(40).optional(),
  source: z.string().max(40).optional(),
  couponCode: z.string().max(40).optional(),
});

const listSchema = z.object({
  status: z.string().optional(),
  q: z.string().max(120).optional(),
  vehicleId: z.string().optional(),
  sort: z.enum(["newest", "oldest", "amount-desc", "amount-asc"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function GET(req: Request) {
  const blocked = await guard(req, "bookings-list", 120);
  if (blocked) return blocked;

  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(422, "Invalid query.");

  return ok(await listBookings(parsed.data));
}

export async function POST(req: Request) {
  const blocked = await guard(req, "bookings-create", 10);
  if (blocked) return blocked;

  const body = await readJson(req, createSchema);
  if (!body.ok) return body.response;

  try {
    const result = await createBooking(body.data);

    /*
     * A booking moves stock, so the cached pages have to be told.
     *
     * Creating a booking fires `booking.created`, whose automation rule
     * decrements `unitsAvailable` — the stock really does drop. Nothing
     * revalidated, though, and the home page and every car page are cached for
     * five minutes, so for up to five minutes a car could read "Last one
     * available" on its own page while the listing already showed it gone.
     * The home page says "Live availability, checked on every answer" directly
     * above that stale number.
     *
     * Vehicle creation was the only call site of `revalidatePath` in the
     * codebase. This is the other write that changes what a visitor sees.
     */
    revalidatePath("/");
    revalidatePath("/cars");
    revalidatePath(`/cars/${result.vehicle.slug}`);
    return ok(
      {
        reference: result.booking.reference,
        status: result.booking.status,
        vehicle: { slug: result.vehicle.slug, name: result.vehicle.name, imageUrl: result.vehicle.imageUrl },
        quote: result.quote,
        pickupAt: result.booking.pickupAt,
        dropoffAt: result.booking.dropoffAt,
        pickupLocation: result.booking.pickupLocation,
        customer: { name: result.customer.name, email: result.customer.email },
        automation: result.automation.map((a) => ({
          rule: a.ruleName,
          status: a.status,
          steps: a.steps,
          durationMs: a.durationMs,
        })),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BookingError) return fail(err.status, err.message);
    throw err;
  }
}
