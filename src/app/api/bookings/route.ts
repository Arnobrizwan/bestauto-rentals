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
  const blocked = guard(req, "bookings-list", 120);
  if (blocked) return blocked;

  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(422, "Invalid query.");

  return ok(await listBookings(parsed.data));
}

export async function POST(req: Request) {
  const blocked = guard(req, "bookings-create", 10);
  if (blocked) return blocked;

  const body = await readJson(req, createSchema);
  if (!body.ok) return body.response;

  try {
    const result = await createBooking(body.data);
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
