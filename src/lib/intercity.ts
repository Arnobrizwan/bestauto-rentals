/**
 * Fixed intercity route pricing, between any two cities we serve.
 *
 * The policy corpus has always told customers that intercity trips "each have
 * a fixed round-trip rate that includes the driver's food and accommodation" —
 * and nothing in the codebase could quote one. The concierge repeated the
 * promise and then had to ask the customer to call. This is the missing half.
 *
 * Nothing here is a table of invented prices. Distance comes from the cities'
 * own coordinates, and the rate comes from the two numbers the business
 * already publishes — the 120km a day a hire includes, and the vehicle's own
 * daily rate. A route's price therefore moves with the car and cannot drift
 * away from the day rate shown beside it, and adding a branch adds its routes
 * automatically rather than needing another row of guesses.
 *
 * Imports nothing, so a client component can price a route without pulling the
 * database layer into the browser bundle.
 */

/** Kilometres a day's hire covers before intercity pricing takes over. */
export const DAILY_KM_ALLOWANCE = 120;

/** The driver's food and accommodation, per night away from base, in BDT. */
export const DRIVER_NIGHT_ALLOWANCE = 1_500;

/**
 * Published road distances, in kilometres, for the routes people actually ask
 * for. Symmetric — stored once, looked up either way round.
 *
 * These are used in preference to the estimate below because no single
 * winding factor survives Bangladesh's rivers: Dhaka to Khulna is 136km in a
 * straight line and 270km by road, because the road goes where the bridges
 * are. Pretending otherwise would have under-quoted that route by a third.
 */
const KNOWN_ROAD_KM: Record<string, number> = {
  "Chattogram|Dhaka": 264,
  "Dhaka|Sylhet": 240,
  "Dhaka|Khulna": 270,
  "Dhaka|Rajshahi": 256,
  "Cox's Bazar|Dhaka": 414,
  "Dhaka|Sreemangal": 190,
  "Bandarban|Dhaka": 330,
  "Chattogram|Cox's Bazar": 152,
  "Bandarban|Chattogram": 75,
  "Sreemangal|Sylhet": 60,
};

/**
 * How much longer the road is than the straight line, where no published
 * distance exists.
 *
 * Calibrated on the pairs above and only ever a fallback — `estimated` on the
 * quote says which of the two a figure came from, so the page can be honest
 * about it rather than presenting a guess as a measurement.
 */
const ROAD_WINDING_FACTOR = 1.35;

/** Key for the distance table, order-independent. */
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** Where each place we quote is, for the distance between any two of them. */
export const PLACES: Record<string, { lat: number; lon: number; note?: string }> = {
  Dhaka: { lat: 23.8103, lon: 90.4125 },
  Chattogram: { lat: 22.3569, lon: 91.7832 },
  Sylhet: { lat: 24.8949, lon: 91.8687 },
  Khulna: { lat: 22.8456, lon: 89.5403 },
  Rajshahi: { lat: 24.3745, lon: 88.6042 },
  "Cox's Bazar": { lat: 21.4272, lon: 92.0058 },
  Sreemangal: { lat: 24.3065, lon: 91.7296 },
  Bandarban: { lat: 22.1953, lon: 92.2184, note: "4WD only — X-Trail, Pajero Sport or Prado" },
};

/** Great-circle distance in kilometres. */
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimated road distance between two places, to the nearest 10km.
 *
 * Rounded because quoting "263.7km" from a winding factor would claim a
 * precision this does not have.
 */
export function roadKm(from: string, to: string): { km: number; estimated: boolean } | null {
  const a = PLACES[from];
  const b = PLACES[to];
  if (!a || !b || from === to) return null;

  const known = KNOWN_ROAD_KM[pairKey(from, to)];
  if (known !== undefined) return { km: known, estimated: false };

  return { km: Math.round((haversineKm(a, b) * ROAD_WINDING_FACTOR) / 10) * 10, estimated: true };
}

export type IntercityQuote = {
  from: string;
  to: string;
  oneWayKm: number;
  /** True when the distance is a straight-line estimate, not a published road figure. */
  estimated: boolean;
  roundTripKm: number;
  /** Days of mileage allowance the round trip consumes. */
  billableDays: number;
  nights: number;
  base: number;
  driverAllowance: number;
  total: number;
  note?: string;
};

/**
 * What a fixed round trip between two cities costs in this vehicle.
 *
 * The round trip is converted into days at the published 120km allowance, so a
 * 530km return to Chattogram is five days of mileage however fast it is
 * driven, and the driver is paid for the nights in between. Both halves are
 * returned separately so the page can show the customer the arithmetic rather
 * than a number they have to trust.
 */
export function intercityQuote(pricePerDay: number, from: string, to: string): IntercityQuote | null {
  const distance = roadKm(from, to);
  if (!distance) return null;

  const oneWayKm = distance.km;
  const roundTripKm = oneWayKm * 2;
  const billableDays = Math.max(1, Math.ceil(roundTripKm / DAILY_KM_ALLOWANCE));
  const nights = Math.max(0, billableDays - 1);
  const base = billableDays * pricePerDay;
  const driverAllowance = nights * DRIVER_NIGHT_ALLOWANCE;

  return {
    from,
    to,
    oneWayKm,
    estimated: distance.estimated,
    roundTripKm,
    billableDays,
    nights,
    base,
    driverAllowance,
    total: base + driverAllowance,
    note: PLACES[to]?.note,
  };
}

/** Every destination reachable from `from`, priced for one vehicle, nearest first. */
export function intercityQuotesFrom(pricePerDay: number, from: string): IntercityQuote[] {
  return Object.keys(PLACES)
    .filter((to) => to !== from)
    .map((to) => intercityQuote(pricePerDay, from, to))
    .filter((q): q is IntercityQuote => q !== null)
    .sort((a, b) => a.oneWayKm - b.oneWayKm);
}

/** The city a branch name belongs to — "Dhaka Banani" is in Dhaka. */
export function cityOfBranch(branch: string): string {
  // Longest first, so "Cox's Bazar" is not shadowed by a shorter prefix.
  const known = Object.keys(PLACES).sort((a, b) => b.length - a.length);
  const match = known.find((city) => branch.startsWith(city));
  if (match) return match;
  // The airport is in Dhaka but does not say so.
  if (/airport|shahjalal/i.test(branch)) return "Dhaka";
  return branch;
}

/**
 * Is this hire an intercity one, and between where?
 *
 * Returns null when both ends are the same city, which is the ordinary
 * in-city hire the daily rate already covers, and when either end is
 * somewhere we do not quote.
 */
export function routeBetween(pickupBranch: string, dropoffBranch: string) {
  const from = cityOfBranch(pickupBranch);
  const to = cityOfBranch(dropoffBranch);
  if (from === to) return null;
  if (!PLACES[from] || !PLACES[to]) return null;
  return { from, to };
}
