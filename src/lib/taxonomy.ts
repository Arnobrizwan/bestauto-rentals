/**
 * The fleet's closed vocabularies, in one place.
 *
 * These lists were duplicated three times — the create-vehicle API's zod
 * enums, the admin form's dropdowns, and the seed — and the copies had already
 * drifted apart in two ways that mattered:
 *
 *   - `segment` offered "popular", which is not a segment. `listVehicles`
 *     treats it as a *sort* and skips the WHERE clause for it, so a vehicle
 *     saved that way matched no segment filter on the public site, showed up as
 *     its own bogus row on the segments page, and could never be reached by the
 *     concierge, whose segment slot is small | large | exclusive.
 *   - `fuel` omitted Octane, which is what a third of the seeded fleet runs on
 *     and which the concierge's slot parser explicitly recognises. The create
 *     endpoint rejected the most ordinary fuel grade in the country.
 *
 * Pure data with no imports, so the API, the seed and the client-side admin
 * forms can all share it rather than keeping their own copy.
 */

/** Stored on the vehicle. "popular" is deliberately absent — it is a sort. */
export const SEGMENTS = ["small", "large", "exclusive"] as const;

export const TRANSMISSIONS = ["Automatic", "Manual"] as const;

/** Octane is a distinct grade in Bangladesh, not a synonym for petrol. */
export const FUELS = ["Petrol", "Octane", "Diesel", "Hybrid", "Electric", "CNG"] as const;

/**
 * A starting point, not a closed set: `bodyType` is free text on the vehicle,
 * so the admin form offers these plus whatever the fleet already uses.
 */
export const BODY_TYPES = ["Sedan", "Hatchback", "SUV", "Microbus", "Crossover", "Estate"] as const;

/** Payment rails people in Bangladesh actually use. */
export const PAYMENT_METHODS = [
  "bKash",
  "Nagad",
  "Rocket",
  "SSLCOMMERZ",
  "Visa",
  "Bank transfer",
  "Cash on pickup",
] as const;

export type Segment = (typeof SEGMENTS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type Fuel = (typeof FUELS)[number];

/**
 * Image hosts `next/image` and the CSP will actually load.
 *
 * The create endpoint accepted any https URL while `next.config.ts` allows one
 * remote pattern and the CSP's `img-src` allows the same single host — so a
 * dealer photo or a Google image URL passed validation, went live on the home
 * page and the fleet, and rendered as a broken image. Keep this in step with
 * `next.config.ts`; it is the same list, enforced at the point of entry rather
 * than discovered by a customer.
 */
export const ALLOWED_IMAGE_HOSTS = ["images.unsplash.com"] as const;

/** Is this a URL the site can actually render? */
export function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.includes(url.hostname as (typeof ALLOWED_IMAGE_HOSTS)[number]);
  } catch {
    return false;
  }
}

/**
 * Every branch, in one place.
 *
 * This list lived in `server/repositories/vehicles.ts` and was duplicated
 * verbatim inside the concierge as `LOCATIONS`, so adding a branch meant
 * editing two files — and forgetting the second one left the assistant unable
 * to recognise a branch the rest of the site was already offering. It sits
 * here, next to the other closed vocabularies, because this module imports
 * nothing and both the database layer and the AI layer can read it.
 */
export const BRANCHES = [
  "Dhaka Gulshan",
  "Dhaka Banani",
  "Dhaka Uttara",
  "Dhaka Dhanmondi",
  "Dhaka Motijheel",
  "Hazrat Shahjalal Airport",
  "Chattogram Agrabad",
  "Sylhet City",
  "Khulna City",
  "Rajshahi City",
  "Cox's Bazar",
] as const;

/**
 * What can be true of one registered car.
 *
 * `available` and `on-hire` are both stock — a car out on hire is still part
 * of the fleet, and the booking that took it already moved the counter.
 * `maintenance` and `off-road` are not: those are the two that must take a
 * unit out of `vehicles.unitsAvailable`, or a car on a garage ramp stays
 * bookable on the public site. Shared by the units API, the repository that
 * moves the stock, and the select on the units row.
 */
export const UNIT_STATUSES = ["available", "on-hire", "maintenance", "off-road"] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Off the road is the half of the vocabulary that is not bookable stock. */
export function isOffRoad(status: string) {
  return status === "maintenance" || status === "off-road";
}
