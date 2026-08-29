import { emit } from "@/automation/engine";
import { EXTRA_PRICES, ONE_OFF_EXTRAS, durationDiscount } from "@/ai/tools";
import { log } from "@/lib/observability/logger";
import { formatCurrency } from "@/lib/utils";
import { sanitizeText } from "@/lib/security/http";
import { countOverlapping, getBookingByReference, insertBooking, updateBookingStatus } from "@/server/repositories/bookings";
import { findRedeemableCoupon, redeemCoupon } from "@/server/repositories/fleet-ops";
import { upsertCustomer } from "@/server/repositories/customers";
import { adjustAvailability } from "@/server/repositories/vehicles";
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
    // A one-off is billed once for the hire, not once a day.
    total: EXTRA_PRICES[name] * (ONE_OFF_EXTRAS.has(name) ? 1 : days),
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

export type CouponOutcome =
  | { ok: true; code: string; id: string; discount: number }
  | { ok: false; reason: string };

/**
 * Prices a coupon against a quote.
 *
 * Percentage codes come off the already-duration-discounted subtotal rather
 * than the list price, so a long hire cannot stack its way below cost, and a
 * flat code is capped at the subtotal so a small booking can never produce a
 * negative total.
 */
export function priceCoupon(
  coupon: { id: string; code: string; kind: string; value: number; minDays: number; usageLimit: number; usedCount: number; live: boolean },
  subtotal: number,
  days: number,
): CouponOutcome {
  if (!coupon.live) return { ok: false, reason: "That code is not active." };
  if (days < coupon.minDays) {
    return { ok: false, reason: `That code needs a booking of at least ${coupon.minDays} days.` };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "That code has been fully redeemed." };
  }

  const raw = coupon.kind === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  const discount = Number(Math.min(raw, subtotal).toFixed(2));
  if (discount <= 0) return { ok: false, reason: "That code takes nothing off this booking." };

  return { ok: true, code: coupon.code, id: coupon.id, discount };
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
  couponCode?: string;
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

  // A coupon is redeemed here, against the server's own quote — the client
  // never gets to say what a code is worth.
  let coupon: CouponOutcome | null = null;
  if (input.couponCode?.trim()) {
    const found = await findRedeemableCoupon(input.couponCode);
    if (!found) throw new BookingError("That code was not recognised.", 422);

    coupon = priceCoupon(found, priced.base - priced.discount, days);
    if (!coupon.ok) throw new BookingError(coupon.reason, 422);

    // The increment is conditional on the limit, so two bookings racing for the
    // last redemption cannot both win it.
    if (!(await redeemCoupon(found.id))) {
      throw new BookingError("That code has been fully redeemed.", 409);
    }
  }

  const couponDiscount = coupon?.ok ? coupon.discount : 0;
  const total = Number((priced.total - couponDiscount).toFixed(2));

  const customer = await upsertCustomer({
    name: sanitizeText(input.customer.name, 120),
    email: input.customer.email.trim().toLowerCase(),
    phone: input.customer.phone ? sanitizeText(input.customer.phone, 40) : "",
    city: input.customer.city ? sanitizeText(input.customer.city, 80) : "",
    country: input.customer.country ?? "Bangladesh",
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
    couponCode: coupon?.ok ? coupon.code : "",
    couponDiscount: couponDiscount.toFixed(2),
    total: total.toFixed(2),
    status: "success",
    paymentMethod: input.paymentMethod ?? "bKash",
    extras: priced.extras.map((e) => e.name),
    source: input.source ?? "web",
  });

  log.info("booking.created", { reference, vehicle: vehicle.slug, total, coupon: coupon?.ok ? coupon.code : undefined });

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
      // The amount actually charged, not the pre-coupon quote: the high-value
      // review rule must not fire on money the customer never paid.
      total: formatCurrency(total),
      totalValue: total,
      couponCode: coupon?.ok ? coupon.code : "",
    },
  });

  return { booking, vehicle, customer, quote: { ...priced, couponDiscount, total }, automation };
}

/**
 * Cancels a booking and lets the automation engine know.
 *
 * This existed with no callers at all: `/api/bookings/[reference]` exported
 * only GET, so nothing in the product could reach it, and the shipped
 * "Cancellation recovery" rule listened for a `booking.cancelled` event that
 * could never be emitted. An automation nobody can trigger is a rule in a
 * table, not a feature.
 */
export async function cancelBooking(id: string, payload: Record<string, unknown>) {
  const updated = await updateBookingStatus(id, "cancelled");
  if (!updated) throw new BookingError("Booking not found.", 404);
  const automation = await emit("booking.cancelled", { booking: { id, ...payload } });
  return { booking: updated, automation };
}

/**
 * Moves a booking between the statuses the dashboard already counts.
 *
 * Cancelling routes through `cancelBooking` so the event fires and the
 * recovery rule runs; the other transitions are a plain status change. A
 * cancelled booking releases the unit it was holding, because the inventory
 * rule that took one on creation has no counterpart — without this the stock
 * stays down forever on a booking that no longer exists.
 */
export async function setBookingStatus(reference: string, status: "pending" | "success" | "cancelled") {
  const row = await getBookingByReference(reference);
  if (!row) throw new BookingError("Booking not found.", 404);

  const was = row.booking.status;
  if (was === status) return { booking: row.booking, automation: null, released: false, slug: row.vehicle.slug };

  if (status === "cancelled") {
    const result = await cancelBooking(row.booking.id, {
      reference: row.booking.reference,
      total: Number(row.booking.total),
      vehicleId: row.booking.vehicleId,
      customerId: row.booking.customerId,
    });
    // Give the unit back, once, and only when leaving a state that held one.
    if (was !== "cancelled") await adjustAvailability(row.booking.vehicleId, 1);
    return { booking: result.booking, automation: result.automation, released: true, slug: row.vehicle.slug };
  }

  const updated = await updateBookingStatus(row.booking.id, status);
  if (!updated) throw new BookingError("Booking not found.", 404);

  // Coming back from cancelled re-commits the unit.
  const retaken = was === "cancelled";
  if (retaken) await adjustAvailability(row.booking.vehicleId, -1);

  return { booking: updated, automation: null, released: false, retaken, slug: row.vehicle.slug };
}
