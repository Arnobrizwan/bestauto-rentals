"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/utils";

const EXTRAS = [
  { name: "Full insurance", perDay: 19, note: "Takes the excess to zero" },
  { name: "Additional driver", perDay: 11, note: "Per extra driver" },
  { name: "Child seat", perDay: 8, note: "ISOFIX where supported" },
  { name: "Unlimited mileage", perDay: 12, note: "Removes the 250 mile/day cap" },
  { name: "Wi-Fi hotspot", perDay: 6, note: "4G, unlimited data" },
  { name: "Airport delivery", perDay: 45, note: "Charged once, not per day" },
];

const ONE_OFF = new Set(["Airport delivery"]);

function discountRate(days: number) {
  if (days >= 28) return 0.25;
  if (days >= 14) return 0.18;
  if (days >= 7) return 0.12;
  if (days >= 3) return 0.05;
  return 0;
}

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
  const [pickupAt, setPickupAt] = useState(isoIn(3));
  const [dropoffAt, setDropoffAt] = useState(isoIn(6));
  const [pickupLocation, setPickupLocation] = useState(defaultLocation);
  const [extras, setExtras] = useState<string[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    const diff = new Date(dropoffAt).getTime() - new Date(pickupAt).getTime();
    return Number.isFinite(diff) ? Math.max(0, Math.ceil(diff / 86_400_000)) : 0;
  }, [pickupAt, dropoffAt]);

  const totals = useMemo(() => {
    const base = pricePerDay * days;
    const rate = discountRate(days);
    const discount = base * rate;
    const extrasTotal = extras.reduce((sum, name_) => {
      const extra = EXTRAS.find((e) => e.name === name_);
      if (!extra) return sum;
      return sum + extra.perDay * (ONE_OFF.has(name_) ? 1 : days);
    }, 0);
    return { base, rate, discount, extrasTotal, total: base - discount + extrasTotal };
  }, [pricePerDay, days, extras]);

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
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-3xl font-bold text-ink-900">
          {formatCurrency(pricePerDay)}
          <span className="text-sm font-medium text-ink-400"> / day</span>
        </p>
        {totals.rate > 0 && (
          <span className="rounded-md bg-success-soft px-2 py-1 text-[12px] font-bold text-success">
            −{Math.round(totals.rate * 100)}% applied
          </span>
        )}
      </div>

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
                  £{extra.perDay}
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
            placeholder="Amelia Whitfield"
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
            placeholder="+44 7700 900123"
          />
        </label>
      </div>

      <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
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
        Free cancellation up to 48 hours before pick-up. No card needed to reserve.
      </p>
    </form>
  );
}
