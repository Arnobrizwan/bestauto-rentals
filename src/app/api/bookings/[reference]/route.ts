import { fail, ok } from "@/lib/security/http";
import { getBookingByReference } from "@/server/repositories/bookings";

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
