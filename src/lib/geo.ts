/**
 * Which branch to open the search on.
 *
 * The pick-up select opened on "the first branch whose name starts with Dhaka"
 * for everybody, so a customer in Chattogram was shown Dhaka Gulshan and had
 * to notice and change it before the dates meant anything.
 *
 * Vercel puts the request's city and country on every request as
 * `x-vercel-ip-city` / `x-vercel-ip-country`, so the branch can be chosen
 * without a permission prompt and without the visitor doing anything. It is
 * city-level and occasionally wrong — a mobile network can place someone a
 * district away — so this only ever changes which option is *preselected*, and
 * every branch stays in the list.
 *
 * Pure and dependency-free so it can be unit tested and used from the proxy.
 */

/** Fallback when the header is missing, unrecognised, or outside Bangladesh. */
export const DEFAULT_BRANCH = "Dhaka Gulshan";

/**
 * City as Vercel reports it, mapped to the branch that serves it.
 *
 * Keys are lowercased and cover the spellings that actually turn up: Vercel
 * reports the Chattogram district as "Chittagong" and Cox's Bazar without the
 * apostrophe.
 */
const CITY_TO_BRANCH: Record<string, string> = {
  dhaka: "Dhaka Gulshan",
  gazipur: "Dhaka Uttara",
  narayanganj: "Dhaka Motijheel",
  savar: "Dhaka Uttara",
  chittagong: "Chattogram Agrabad",
  chattogram: "Chattogram Agrabad",
  sylhet: "Sylhet City",
  khulna: "Khulna City",
  rajshahi: "Rajshahi City",
  "cox's bazar": "Cox's Bazar",
  "coxs bazar": "Cox's Bazar",
  "cox bazar": "Cox's Bazar",
};

/**
 * The branch to preselect for a request from `city` in `country`.
 *
 * Outside Bangladesh there is no useful answer — an overseas visitor booking a
 * car in Dhaka is the normal case, not someone wanting a branch near them — so
 * the default stands rather than guessing.
 */
export function branchForRequest(city?: string | null, country?: string | null): string {
  if (country && country.toUpperCase() !== "BD") return DEFAULT_BRANCH;
  if (!city) return DEFAULT_BRANCH;

  // Vercel percent-encodes non-ASCII city names.
  let decoded = city;
  try {
    decoded = decodeURIComponent(city);
  } catch {
    /* a malformed header is just an unknown city */
  }

  return CITY_TO_BRANCH[decoded.trim().toLowerCase()] ?? DEFAULT_BRANCH;
}

/** Cookie the proxy writes and the search panel reads. Not sensitive. */
export const BRANCH_COOKIE = "bestauto_branch";

/**
 * Where each branch actually is.
 *
 * The IP city can only ever answer "Dhaka", and we run five branches in Dhaka
 * — so for someone standing in Uttara it picks Gulshan, which is the right
 * city and the wrong side of it. These coordinates are what turns a precise
 * fix from the browser into the branch a customer can actually walk to.
 */
export const BRANCH_COORDS: Record<string, { lat: number; lon: number }> = {
  "Dhaka Gulshan": { lat: 23.7925, lon: 90.4078 },
  "Dhaka Banani": { lat: 23.7937, lon: 90.4066 },
  "Dhaka Uttara": { lat: 23.8759, lon: 90.3795 },
  "Dhaka Dhanmondi": { lat: 23.7461, lon: 90.3742 },
  "Dhaka Motijheel": { lat: 23.7331, lon: 90.4172 },
  "Hazrat Shahjalal Airport": { lat: 23.8433, lon: 90.3978 },
  "Chattogram Agrabad": { lat: 22.3269, lon: 91.8123 },
  "Sylhet City": { lat: 24.8949, lon: 91.8687 },
  "Khulna City": { lat: 22.8456, lon: 89.5403 },
  "Rajshahi City": { lat: 24.3745, lon: 88.6042 },
  "Cox's Bazar": { lat: 21.4272, lon: 92.0058 },
};

/** Straight-line kilometres. Good enough to rank branches by closeness. */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * The closest branch to a precise position.
 *
 * `available` is the branch list the page is actually showing, so this can
 * never select a branch the select box does not offer. Straight-line distance
 * rather than driving distance: it only has to rank, and the nearest branch as
 * the crow flies is the nearest one to drive to in every case here.
 */
export function nearestBranch(lat: number, lon: number, available?: readonly string[]): string {
  const candidates = Object.entries(BRANCH_COORDS).filter(
    ([name]) => !available || available.includes(name),
  );
  if (!candidates.length) return DEFAULT_BRANCH;

  return candidates.reduce((best, current) =>
    distanceKm({ lat, lon }, current[1]) < distanceKm({ lat, lon }, best[1]) ? current : best,
  )[0];
}
