import { emit } from "@/automation/engine";
import { EXTRA_PRICES, durationDiscount } from "@/ai/tools";
import { log } from "@/lib/observability/logger";
import { sanitizeText } from "@/lib/security/http";
import { countOverlapping, insertBooking, updateBookingStatus } from "@/server/repositories/bookings";
import { upsertCustomer } from "@/server/repositories/customers";
import { getVehicleBySlug } from "@/server/repositories/vehicles";

export type Quote = {
  pricePerDay: number;
  days: number;
  base: number;
  discountRate: number;
  discount: number;
  extras: { name: string; perDay: number; total: number }[];
  extrasTotal: number;
  total: number;
};

/** Pricing lives in one place so the quote a customer sees is the one charged. */
export function quote(pricePerDay: number, days: number, extras: string[]): Quote {
  const base = pricePerDay * days;
  const discountRate = durationDiscount(days);
  const discount = Number((base * discountRate).toFixed(2));
  const valid = extras.filter((e) => e in EXTRA_PRICES);
  const extraLines = valid.map((name) => ({
    name,
    perDay: EXTRA_PRICES[name],
    total: EXTRA_PRICES[name] * days,
  }));
  const extrasTotal = extraLines.reduce((sum, e) => sum + e.total, 0);
  return {
    pricePerDay,
    days,
    base: Number(base.toFixed(2)),
    discountRate,
    discount,
    extras: extraLines,
    extrasTotal,
    total: Number((base - discount + extrasTotal).toFixed(2)),
  };
}

export function dayCount(pickupAt: Date, dropoffAt: Date) {
  return Math.max(1, Math.ceil((dropoffAt.getTime() - pickupAt.getTime()) / 86_400_000));
}

export type CreateBookingInput = {
  vehicleSlug: string;
  customer: { name: string; email: string; phone?: string; city?: string; country?: string };
  pickupLocation: string;
  dropoffLocation?: string;
  pickupAt: string;
  dropoffAt: string;
  extras?: string[];
  paymentMethod?: string;
  source?: string;
};

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export async function createBooking(input: CreateBookingInput) {
  const vehicle = await getVehicleBySlug(input.vehicleSlug);
  if (!vehicle) throw new BookingError("That vehicle is not in the fleet.", 404);

  const pickupAt = new Date(input.pickupAt);
  const dropoffAt = new Date(input.dropoffAt);
  if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(dropoffAt.getTime())) {
    throw new BookingError("Pick-up and drop-off must be valid dates.", 422);
  }
  if (dropoffAt <= pickupAt) throw new BookingError("Drop-off must be after pick-up.", 422);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (pickupAt < startOfToday) throw new BookingError("Pick-up cannot be in the past.", 422);

  const days = dayCount(pickupAt, dropoffAt);
  if (days > 90) throw new BookingError("Rentals are capped at 90 days. Talk to us about a long-term lease.", 422);

  // Availability is checked against committed units, not a cached counter.
  const committed = await countOverlapping(vehicle.id, pickupAt, dropoffAt);
  if (committed >= vehicle.unitsTotal) {
    throw new BookingError(`The ${vehicle.name} is fully booked across those dates.`, 409);
  }

  const priced = quote(Number(vehicle.pricePerDay), days, input.extras ?? []);

  const customer = await upsertCustomer({
    name: sanitizeText(input.customer.name, 120),
    email: input.customer.email.trim().toLowerCase(),
    phone: input.customer.phone ? sanitizeText(input.customer.phone, 40) : "",
    city: input.customer.city ? sanitizeText(input.customer.city, 80) : "",
    country: input.customer.country ?? "United Kingdom",
  });

  const reference = `BA-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  const booking = await insertBooking({
    id: `bkg_${crypto.randomUUID().slice(0, 12)}`,
    reference,
    vehicleId: vehicle.id,
    customerId: customer.id,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation || input.pickupLocation,
    pickupAt,
    dropoffAt,
    days,
    subtotal: (priced.base - priced.discount).toFixed(2),
    extrasTotal: priced.extrasTotal.toFixed(2),
    total: priced.total.toFixed(2),
    status: "success",
    paymentMethod: input.paymentMethod ?? "Stripe",
    extras: priced.extras.map((e) => e.name),
    source: input.source ?? "web",
  });

  log.info("booking.created", { reference, vehicle: vehicle.slug, total: priced.total });

  const automation = await emit("booking.created", {
    booking: {
      id: booking.id,
      reference: booking.reference,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      customerName: customer.name,
      customerEmail: customer.email,
      days,
      pickupDate: pickupAt.toISOString().slice(0, 10),
      pickupLocation: booking.pickupLocation,
      total: `GBP ${priced.total.toFixed(2)}`,
      totalValue: priced.total,
    },
  });

  return { booking, vehicle, customer, quote: priced, automation };
}

export async function cancelBooking(id: string, payload: Record<string, unknown>) {
  const updated = await updateBookingStatus(id, "cancelled");
  if (!updated) throw new BookingError("Booking not found.", 404);
  const automation = await emit("booking.cancelled", { booking: { id, ...payload } });
  return { booking: updated, automation };
}
