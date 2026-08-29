/**
 * Runtime validation for anything a model hands back.
 *
 * Every hosted agent used to parse the model's JSON with a bare cast, which
 * tells TypeScript what the shape *should* be and checks nothing. The visible
 * result was the operations brief rendering a raw float as a metric chip —
 * `53.6015004126` where the rules engine writes `+53.6% revenue` — because the
 * model's string was passed straight through to the dashboard.
 */

/** One decimal place at most, and no trailing `.0`. */
function round1(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Units a metric can carry, most specific first.
 *
 * Order is the whole point. "10% of bookings in this window cancelled" contains
 * the word "bookings", so a first-match-wins list with `booking` above `cancel`
 * rendered a cancellation *rate* as a *count* — "10 bookings" for what is
 * actually 10% cancelled. A rate mislabelled as a count is worse than no unit
 * at all, because it reads as plausible.
 */
const UNITS: { match: RegExp; unit: string; isPercentage: boolean }[] = [
  { match: /\bcancel/i, unit: "% cancelled", isPercentage: true },
  { match: /\butilisation|\butilization|\bidle capacity/i, unit: "% utilisation", isPercentage: true },
  { match: /\bconversion/i, unit: "% conversion", isPercentage: true },
  { match: /\bmargin/i, unit: "% margin", isPercentage: true },
  { match: /\brevenue|\bturnover/i, unit: "% revenue", isPercentage: true },
  { match: /\bbooking/i, unit: " bookings", isPercentage: false },
  { match: /\blead/i, unit: " leads", isPercentage: false },
  { match: /\bcustomer/i, unit: " customers", isPercentage: false },
];

/**
 * Does the surrounding text show this number as a percentage?
 *
 * Read from the number's own context rather than guessed from keywords: if the
 * detail says "10%", the chip must not claim ten of anything. Both the rounded
 * and the raw form are looked for, since the model's prose and its metric field
 * do not always agree on decimal places.
 */
function showsPercentage(hint: string, numeric: number): boolean {
  const forms = new Set([round1(numeric), String(numeric), numeric.toFixed(1), String(Math.round(numeric))]);
  for (const form of forms) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escaped}\\s*(?:%|per\\s?cent|percent)`, "i").test(hint)) return true;
  }
  return false;
}

/**
 * The unit a bare number was probably measuring.
 *
 * A model that returns `53.6` has dropped the unit, and the number alone is
 * meaningless on a chip. The surrounding title and detail are the only thing
 * left to infer it from — imperfect, but far better than showing a naked
 * float, and the prompt now asks for a unit-bearing string so this is the
 * fallback rather than the norm.
 *
 * When nothing matches, no unit is added. Defaulting to "%" was the same
 * mistake in the other direction: a confident label on a number nothing in the
 * text supports.
 */
function inferUnit(hint: string, numeric: number): string {
  const entry = UNITS.find((u) => u.match.test(hint));
  const percentage = showsPercentage(hint, numeric);

  if (!entry) return percentage ? "%" : "";
  // The text shows a percentage but the noun that matched is a countable one:
  // label it as a percentage rather than as a count of that noun.
  if (percentage && !entry.isPercentage) return "%";
  return entry.unit;
}

/**
 * Renders a metric chip.
 *
 * A number — or a string that is only a number — is rounded to one decimal
 * place and given a unit. Anything else is already a display string and is
 * only trimmed. Nothing returned here exceeds 24 characters or carries more
 * than one decimal place.
 */
export function normaliseMetric(value: unknown, hint = ""): string {
  const raw = typeof value === "string" ? value.trim() : value;

  const numeric =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(raw)
        ? Number(raw)
        : null;

  if (numeric === null) {
    return String(raw ?? "")
      .trim()
      .slice(0, 24);
  }

  // A positive change reads as a change only if the wording says so; an
  // absolute count must not acquire a leading plus.
  const isDelta = /\b(up|down|increase|decrease|growth|rose|fell|higher|lower|vs|change)\b/i.test(hint);
  const sign = isDelta && numeric > 0 ? "+" : "";

  return `${sign}${round1(numeric)}${inferUnit(hint, numeric)}`.slice(0, 24);
}

/** Clamps to an integer inside a range, for a score a model invented. */
export function clampScore(value: unknown, min = 0, max = 100): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}
