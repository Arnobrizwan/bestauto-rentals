"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { cn, toDateInput } from "@/lib/utils";

/**
 * The pick-up and drop-off dates, on the fleet page.
 *
 * This was a read-only pill. It showed the dates carried over from the home
 * page search, looked like a control — rounded, bordered, calendar icon — and
 * did nothing when clicked, with no way to change the dates short of going
 * back to the home page and searching again.
 *
 * Worse, the dates it displayed did not filter anything: every car in the
 * catalogue was listed whether or not it was free then, so a car already
 * booked out for those days sat in the results looking available. The listing
 * query now takes the range, and this is the control that sets it.
 */

/** The `T10:00` half, so editing a date does not quietly discard the time. */
const timeOf = (value?: string) => (value && value.length > 10 ? value.slice(10) : "");
export function DateRangeFilter({ pickup, dropoff }: { pickup?: string; dropoff?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [from, setFrom] = useState(toDateInput(pickup));
  const [to, setTo] = useState(toDateInput(dropoff));

  // The URL is the source of truth. When it changes underneath these inputs —
  // the back button, a filter reset elsewhere on the page — the caller keys
  // this component on the range, so React remounts it with the new values
  // rather than an effect writing state after the fact.

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(params.toString());
    // Put the time back on, so a date edit round-trips the value the home
    // page search put there rather than truncating it.
    if (nextFrom) next.set("pickup", `${nextFrom}${timeOf(pickup)}`);
    else next.delete("pickup");
    if (nextTo) next.set("dropoff", `${nextTo}${timeOf(dropoff)}`);
    else next.delete("dropoff");
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // A range only means something with both ends, and only forwards. Applying a
  // half-range would silently show the whole catalogue again.
  //
  // Deliberately not also requiring the dates to have *changed*: arriving with
  // a range already in the URL left the button greyed out, which reads as a
  // broken control rather than as "already applied". Re-applying the same
  // range is harmless, and a button that looks pressable and is pressable
  // beats one that has to be earned.
  const complete = Boolean(from && to);
  const ordered = complete && from <= to;

  const field =
    "h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-300";

  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] text-ink-500">
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 3v4M16 3v4M4 11h16" />
      </svg>

      <label className="sr-only" htmlFor="fleet-pickup">
        Pick-up date
      </label>
      <input
        id="fleet-pickup"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => setFrom(e.target.value)}
        className={field}
      />

      <span aria-hidden className="text-ink-300">
        &rarr;
      </span>

      <label className="sr-only" htmlFor="fleet-dropoff">
        Drop-off date
      </label>
      <input
        id="fleet-dropoff"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => setTo(e.target.value)}
        className={field}
      />

      <button
        type="button"
        onClick={() => apply(from, to)}
        disabled={!ordered || pending}
        className={cn(
          // The border is always there, just transparent when enabled, so the
          // button does not change size as it enables.
          "h-9 rounded-lg border border-transparent bg-ink-900 px-3.5 text-[13px] font-semibold text-white transition-colors",
          // Disabled reads as white and outlined rather than a dimmed dark
          // slab — a faded solid button looks like a rendering fault next to
          // the white inputs it sits beside.
          "disabled:cursor-not-allowed disabled:border-line disabled:bg-white disabled:text-ink-300",
        )}
      >
        {pending ? "Checking…" : "Check availability"}
      </button>

      {(pickup || dropoff) && (
        <button
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
            apply("", "");
          }}
          className="h-9 px-2 text-[13px] font-medium text-ink-400 underline underline-offset-4 hover:text-ink-900"
        >
          Clear
        </button>
      )}

      {complete && !ordered && (
        <span role="alert" className="text-[12px] font-medium text-danger">
          Drop-off must be on or after pick-up.
        </span>
      )}
    </div>
  );
}
