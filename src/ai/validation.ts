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
 * The unit a bare number was probably measuring.
 *
 * A model that returns `53.6` has dropped the unit, and the number alone is
 * meaningless on a chip. The surrounding title and detail are the only thing
 * left to infer it from — imperfect, but far better than showing a naked
 * float, and the prompt now asks for a unit-bearing string so this is the
 * fallback rather than the norm.
 */
function inferUnit(hint: string): string {
  const text = hint.toLowerCase();
  if (text.includes("revenue")) return "% revenue";
  if (text.includes("utilisation") || text.includes("utilization")) return "% utilisation";
  if (text.includes("conversion")) return "% conversion";
  if (text.includes("margin")) return "% margin";
  if (text.includes("booking")) return " bookings";
  if (text.includes("lead")) return " leads";
  if (text.includes("customer")) return " customers";
  return "%";
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

  return `${sign}${round1(numeric)}${inferUnit(hint)}`.slice(0, 24);
}

/** Clamps to an integer inside a range, for a score a model invented. */
export function clampScore(value: unknown, min = 0, max = 100): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}
