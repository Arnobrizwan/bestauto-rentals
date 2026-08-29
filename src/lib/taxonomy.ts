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
