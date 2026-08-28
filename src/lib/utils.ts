import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The whole product prices in GBP - policy copy, quotes and the dashboard all
// have to agree, so there is exactly one formatter.
const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

/**
 * Deterministic compact notation.
 *
 * Intl's `notation: "compact"` disagrees between Node's ICU build and the
 * browser's ("61.4K" vs "61.4k"), which surfaced as a hydration mismatch on the
 * dashboard. Formatting it ourselves keeps server and client byte-identical.
 */
const COMPACT_UNITS = [
  { limit: 1e12, suffix: "T" },
  { limit: 1e9, suffix: "B" },
  { limit: 1e6, suffix: "M" },
  { limit: 1e3, suffix: "k" },
] as const;

export const formatCurrency = (value: number) => currency.format(value);
export function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (const unit of COMPACT_UNITS) {
    if (abs >= unit.limit) {
      const scaled = abs / unit.limit;
      // One decimal below 100, none above - "9.4k", "61.4k", "614k".
      const text = scaled < 100 ? scaled.toFixed(1).replace(/\.0$/, "") : String(Math.round(scaled));
      return `${sign}${text}${unit.suffix}`;
    }
  }
  return `${sign}${Math.round(abs)}`;
}
export const formatNumber = (value: number) => new Intl.NumberFormat("en-GB").format(value);

export const formatDate = (value: Date | string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(
    typeof value === "string" ? new Date(value) : value,
  );

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
