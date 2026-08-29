"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EXTRA_PRICES, ONE_OFF_EXTRAS, durationDiscount, extraTotal } from "@/lib/pricing";
import { formatCurrency, toDateInput } from "@/lib/utils";

const EXTRA_NOTES: Record<string, string> = {
  "Full insurance": "Takes your liability to zero",
  "Additional driver": "Per extra named driver",
  "Child seat": "Fitted and checked before handover",
  "Unlimited mileage": "Removes the 120km/day cap in Dhaka",
  "Wi-Fi hotspot": "4G, unlimited data",
  "Airport pickup": "Name board, one hour waiting. Charged once",
};

/**
 * Prices come from the shared pricing module, never from a copy kept here.
 * The form previously held its own figures and its own one-off rule, which is
 * how the preview came to disagree with what the server actually charged.
 */
const EXTRAS = [
  "Full insurance",
  "Additional driver",
  "Child seat",
  "Unlimited mileage",
  "Wi-Fi hotspot",
  "Airport pickup",
].map((name) => ({ name, perDay: EXTRA_PRICES[name], note: EXTRA_NOTES[name] }));

const ONE_OFF = ONE_OFF_EXTRAS;

function isoIn(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

type Props = {
  slug: string;
  name: string;
  pricePerDay: number;
  locations: string[];
  defaultLocation: string;
};

/**
 * Live booking form. The price shown here is computed with the same discount
 * ladder the server charges, and the server re-prices from scratch on submit —
 * the client total is a preview, never the source of truth.
 */
export function BookingForm({ slug, name, pricePerDay, locations, defaultLocation }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  /*
   * Start from what the customer already told us.
   *
   * This form defaulted to three days from today at the branch the car sits
   * in, ignoring the search that got them here — so someone who searched 1–4
   * September at Dhaka Banani, filtered the fleet on those dates and opened a
   * car was quoted for a different hire than the one they asked for, with no
   * indication their choice had been dropped. The fleet cards forward the
   * search; this reads it, and falls back to the old defaults when there is
   * none (arriving from the home page deals, or a shared link).
   */
  const searchedPickup = toDateInput(params.get("pickup"));
  const searchedDropoff = toDateInput(params.get("dropoff"));
  const searchedLocation = params.get("location");
  const usable = searchedPickup && searchedDropoff && searchedPickup <= searchedDropoff;

  const [pickupAt, setPickupAt] = useState(usable ? searchedPickup : isoIn(3));
  const [dropoffAt, setDropoffAt] = useState(usable ? searchedDropoff : isoIn(6));
  // Only a branch this car is actually at — the search may name a city or a
  // branch the vehicle is not parked in, and offering a pick-up point it
  // cannot be collected from would be worse than ignoring the hint.
  const [pickupLocation, setPickupLocation] = useState(
    searchedLocation && locations.includes(searchedLocation) ? searchedLocation : defaultLocation,
  );
  const [extras, setExtras] = useState<string[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponNote, setCouponNote] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  const days = useMemo(() => {
    const diff = new Date(dropoffAt).getTime() - new Date(pickupAt).getTime();
    return Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / 86_400_000)) : 0;
  }, [pickupAt, dropoffAt]);

  const totals = useMemo(() => {
    const base = pricePerDay * days;
    const rate = durationDiscount(days);
    const discount = base * rate;
    const extrasTotal = extras.reduce((sum, name_) => sum + extraTotal(name_, days), 0);
    const couponDiscount = coupon ? Math.min(coupon.discount, base - discount) : 0;
    return {
      base,
      rate,
      discount,
      extrasTotal,
      couponDiscount,
      total: base - discount + extrasTotal - couponDiscount,
    };
  }, [pricePerDay, days, extras, coupon]);

  // Previewing a code is a read: the booking endpoint looks it up again and
  // re-prices it, so nothing here is load-bearing.
  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code || days < 1) return;
    setCheckingCoupon(true);
    setCouponNote(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, subtotal: totals.base - totals.discount, days }),
      });
      const data = await res.json();
      if (data.valid) {
        setCoupon({ code: data.code, discount: data.discount });
        setCouponNote(null);
      } else {
        setCoupon(null);
        setCouponNote(typeof data.reason === "string" ? data.reason : "That code cannot be used.");
      }
    } catch {
      setCouponNote("Could not check that code.");
    } finally {
      setCheckingCoupon(false);
    }
  }

  function toggleExtra(name_: string) {
    setExtras((prev) => (prev.includes(name_) ? prev.filter((e) => e !== name_) : [...prev, name_]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (days < 1) {
      setError("Drop-off has to be at least a day after pick-up.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleSlug: slug,
          customer,
          pickupLocation,
          pickupAt,
          dropoffAt,
          extras,
          couponCode: coupon?.code,
          source: "web",
        }),
      });

      const data = (await res.json()) as { reference?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "We couldn't complete that booking.");
      router.push(`/booking/${data.reference}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-ink-200 px-3.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 [color-scheme:light]";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink-700";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-card">
      {/*
        The headline is the total, not the daily rate.
        It used to show the per-day price, which is correct but static: ticking
        an extra changed nothing about the largest number on the card while the
        figure that did move sat below the fold, so the form read as though the
        extras were not being counted. The daily rate keeps its place on the
        line underneath, where it explains the total rather than competing with
        it.
      */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-3xl font-bold text-ink-900">
          {formatCurrency(days > 0 ? totals.total : pricePerDay)}
          <span className="text-sm font-medium text-ink-400">
            {days > 0 ? ` total · ${days} ${days === 1 ? "day" : "days"}` : " / day with driver"}
          </span>
        </p>
        {totals.rate > 0 && (
          <span className="rounded-md bg-success-soft px-2 py-1 text-[12px] font-bold text-success">
            −{Math.round(totals.rate * 100)}% applied
          </span>
        )}
      </div>

      {days > 0 && (
        <p className="mt-1 text-[13px] text-ink-400">
          {formatCurrency(pricePerDay)} a day with a driver
          {totals.extrasTotal > 0 && <> · {formatCurrency(totals.extrasTotal)} of extras</>}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Pick-up</span>
          <input type="date" min={isoIn(0)} value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} className={field} required />
        </label>
        <label>
          <span className={labelClass}>Drop-off</span>
          <input type="date" min={pickupAt} value={dropoffAt} onChange={(e) => setDropoffAt(e.target.value)} className={field} required />
        </label>
      </div>

      <label className="mt-4 block">
        <span className={labelClass}>Collect from</span>
        <select value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className={field}>
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-6">
        <legend className={labelClass}>Extras</legend>
        <div className="space-y-1.5">
          {EXTRAS.map((extra) => {
            const checked = extras.includes(extra.name);
            return (
              <label
                key={extra.name}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  checked ? "border-brand-400 bg-brand-50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleExtra(extra.name)}
                  className="size-4 accent-brand-400"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink-900">{extra.name}</span>
                  <span className="block truncate text-[11px] text-ink-400">{extra.note}</span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-ink-600">
                  {formatCurrency(extra.perDay, { decimals: false })}
                  <span className="text-ink-300">{ONE_OFF.has(extra.name) ? "" : "/day"}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4">
        <label>
          <span className={labelClass}>Your name</span>
          <input
            value={customer.name}
            onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
            className={field}
            placeholder="Tanvir Hossain"
            required
            minLength={2}
          />
        </label>
        <label>
          <span className={labelClass}>Email</span>
          <input
            type="email"
            value={customer.email}
            onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
            className={field}
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          <span className={labelClass}>
            Phone <span className="font-normal text-ink-400">(optional)</span>
          </span>
          <input
            type="tel"
            value={customer.phone}
            onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
            className={field}
            placeholder="+880 1712-345678"
          />
        </label>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <label htmlFor="coupon" className={labelClass}>
          Discount code <span className="font-normal text-ink-400">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="coupon"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
              setCoupon(null);
              setCouponNote(null);
            }}
            placeholder="EIDSAFAR"
            maxLength={40}
            autoComplete="off"
            className={`${field} font-mono tracking-wide uppercase`}
          />
          <button
            type="button"
            onClick={applyCoupon}
            disabled={checkingCoupon || !couponCode.trim() || days < 1}
            className="h-11 shrink-0 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-700 transition-colors hover:border-brand-400 hover:text-brand-500 disabled:opacity-40"
          >
            {checkingCoupon ? "Checking…" : "Apply"}
          </button>
        </div>
        {coupon && (
          <p className="mt-1.5 text-[13px] font-medium text-success">
            {coupon.code} applied — {formatCurrency(totals.couponDiscount)} off.
          </p>
        )}
        {couponNote && (
          <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
            {couponNote}
          </p>
        )}
      </div>

      <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
        <div className="flex justify-between text-ink-500">
          <dt>
            {formatCurrency(pricePerDay)} &times; {days} {days === 1 ? "day" : "days"}
          </dt>
          <dd className="font-medium text-ink-900">{formatCurrency(totals.base)}</dd>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-success">
            <dt>Multi-day discount</dt>
            <dd className="font-medium">−{formatCurrency(totals.discount)}</dd>
          </div>
        )}
        {totals.extrasTotal > 0 && (
          <div className="flex justify-between text-ink-500">
            <dt>Extras</dt>
            <dd className="font-medium text-ink-900">{formatCurrency(totals.extrasTotal)}</dd>
          </div>
        )}
        {totals.couponDiscount > 0 && coupon && (
          <div className="flex justify-between text-success">
            <dt>Code {coupon.code}</dt>
            <dd className="font-medium">−{formatCurrency(totals.couponDiscount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-3 font-display text-lg font-bold text-ink-900">
          <dt>Total</dt>
          <dd>{formatCurrency(totals.total)}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || days < 1}
        className="mt-5 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-brand-400 text-[15px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(255,159,67,1)] transition-all hover:bg-brand-500 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Confirming
          </>
        ) : (
          `Book the ${name.split(" ").slice(0, 2).join(" ")}`
        )}
      </button>
      <p className="mt-3 text-center text-[12px] text-ink-400">
        Driver included. Fuel billed at cost. Free cancellation up to 24 hours before pick-up.
      </p>
    </form>
  );
}
