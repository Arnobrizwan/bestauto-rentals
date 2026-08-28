/**
 * The pricing rules, in one dependency-free place.
 *
 * These were spread across three files: the tool registry held the extras and
 * the discount ladder, the booking service re-derived the extras total, and the
 * booking form kept its own copy of both. They drifted — the form billed
 * airport pickup once while the server billed it per day, so a five-day hire
 * previewed at BDT 1,500 and charged BDT 7,500.
 *
 * This module imports nothing, so a client component can read it without
 * pulling the tool executors and the database layer into the browser bundle,
 * which is what kept the form on its own copy in the first place.
 */

/** Extras and their BDT price. Per day unless listed in `ONE_OFF_EXTRAS`. */
export const EXTRA_PRICES: Record<string, number> = {
  "Additional driver": 800,
  "Child seat": 500,
  "Full insurance": 1200,
  "Unlimited mileage": 900,
  "Airport pickup": 1500,
  "Wi-Fi hotspot": 400,
};

/** Charged once for the whole hire rather than once a day. */
export const ONE_OFF_EXTRAS = new Set(["Airport pickup"]);

/** Multi-day discount ladder — the same one the booking service charges. */
export function durationDiscount(days: number) {
  if (days >= 28) return 0.25;
  if (days >= 14) return 0.18;
  if (days >= 7) return 0.12;
  if (days >= 3) return 0.05;
  return 0;
}

/** What one extra costs across the whole hire. */
export function extraTotal(name: string, days: number) {
  const perDay = EXTRA_PRICES[name];
  if (perDay === undefined) return 0;
  return perDay * (ONE_OFF_EXTRAS.has(name) ? 1 : days);
}
