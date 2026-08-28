import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------------------------------------------------------------------
   Money and numbers — Bangladesh.

   All of this is hand-rolled rather than delegated to Intl for two reasons:

   1. Node's `en-BD` does not apply the South Asian lakh/crore digit grouping
      (it renders 12,500,000 where a Bangladeshi reader expects 1,25,00,000),
      and it prints "BDT" rather than the ৳ sign.
   2. Intl's compact notation disagrees between Node's ICU build and the
      browser's, which previously surfaced as a React hydration mismatch.

   Doing it by hand gives correct local convention and byte-identical output on
   the server and the client.
--------------------------------------------------------------------------- */

export const CURRENCY_SYMBOL = "৳";

/** 1234567 -> "12,34,567" (last three digits, then pairs). */
function groupBangla(digits: string) {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

export function formatCurrency(value: number, options: { decimals?: boolean } = {}) {
  const showDecimals = options.decimals ?? Number.isInteger(value) === false;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const fixed = showDecimals ? abs.toFixed(2) : String(Math.round(abs));
  const [whole, fraction] = fixed.split(".");
  return `${sign}${CURRENCY_SYMBOL}${groupBangla(whole)}${fraction ? `.${fraction}` : ""}`;
}

export function formatNumber(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${groupBangla(String(Math.round(Math.abs(value))))}`;
}

/**
 * Compact notation in the units Bangladeshi readers actually use: thousand,
 * lakh (10^5) and crore (10^7) rather than K/M/B.
 */
const COMPACT_UNITS = [
  { limit: 1e7, suffix: "Cr" },
  { limit: 1e5, suffix: "L" },
  { limit: 1e3, suffix: "k" },
] as const;

export function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (const unit of COMPACT_UNITS) {
    if (abs >= unit.limit) {
      const scaled = abs / unit.limit;
      const text = scaled < 100 ? scaled.toFixed(1).replace(/\.0$/, "") : String(Math.round(scaled));
      return `${sign}${text}${unit.suffix}`;
    }
  }
  return `${sign}${Math.round(abs)}`;
}

/** Money in compact form, for chart axes and tight stat labels. */
export const formatCurrencyCompact = (value: number) => `${CURRENCY_SYMBOL}${formatCompact(value)}`;

/* ------------------------------------------------------------------- Dates */

export const formatDate = (value: Date | string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    ...(opts ?? { day: "2-digit", month: "short", year: "numeric" }),
  }).format(typeof value === "string" ? new Date(value) : value);

/** "15 Mins", "3 Hours", "2 Days" — matches the Figma transaction rows. */
export function timeAgo(value: Date | string) {
  const then = typeof value === "string" ? new Date(value) : value;
  const mins = Math.max(1, Math.round((Date.now() - then.getTime()) / 60000));
  if (mins < 60) return `${mins} Min${mins === 1 ? "" : "s"}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} Hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} Day${days === 1 ? "" : "s"}`;
}

export const percent = (value: number, digits = 0) => `${value.toFixed(digits)}%`;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
