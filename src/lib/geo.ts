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
