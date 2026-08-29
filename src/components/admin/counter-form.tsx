"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Field, Input, Select } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/taxonomy";
import { formatCurrency } from "@/lib/utils";

type Vehicle = { slug: string; name: string; pricePerDay: number; seats: number };

/**
 * The counter desk — the walk-in equivalent of the Figma's POS screen.
 *
 * It posts to the same `POST /api/bookings` the public site uses, which means
 * the price is recomputed on the server, availability is checked against
 * overlapping bookings, and the booking automation fires exactly as it would
 * for a customer booking online. A separate counter path that priced things
 * its own way is how the two drift apart.
 */
export function CounterForm({ vehicles, branches }: { vehicles: Vehicle[]; branches: readonly string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; total: number } | null>(null);
  const [slug, setSlug] = useState(vehicles[0]?.slug ?? "");

  const chosen = vehicles.find((v) => v.slug === slug);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      vehicleSlug: String(form.get("vehicleSlug") ?? ""),
      customer: {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
      },
      pickupLocation: String(form.get("pickupLocation") ?? ""),
      dropoffLocation: String(form.get("dropoffLocation") ?? ""),
      pickupAt: new Date(String(form.get("pickupAt"))).toISOString(),
      dropoffAt: new Date(String(form.get("dropoffAt"))).toISOString(),
      paymentMethod: String(form.get("paymentMethod") ?? "Cash on pickup"),
      source: "counter",
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not take the booking.");
        return;
      }
      setDone({ reference: data.booking.reference, total: Number(data.booking.total) });
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 16);

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Vehicle" className="sm:col-span-2">
          <Select name="vehicleSlug" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.name} — {formatCurrency(v.pricePerDay)}/day · {v.seats} seats
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Customer name">
          <Input name="name" required minLength={2} maxLength={120} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required maxLength={200} />
        </Field>
        <Field label="Phone">
          <Input name="phone" maxLength={40} placeholder="01XXXXXXXXX" />
        </Field>
        <Field label="Payment">
          <Select name="paymentMethod" defaultValue="Cash on pickup">
            {PAYMENT_METHODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Collect from">
          <Select name="pickupLocation" defaultValue={branches[0]}>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Return to">
          <Select name="dropoffLocation" defaultValue={branches[0]}>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Out at">
          <Input name="pickupAt" type="datetime-local" required defaultValue={iso(today)} />
        </Field>
        <Field label="Back at">
          <Input
            name="dropoffAt"
            type="datetime-local"
            required
            defaultValue={iso(new Date(today.getTime() + 3 * 86_400_000))}
          />
        </Field>

        {error && (
          <p role="alert" className="text-[13px] text-danger sm:col-span-2">
            {error}
          </p>
        )}

        {done && (
          <p className="rounded-xl bg-success-soft px-4 py-3 text-[13px] text-success sm:col-span-2">
            Booked as <span className="font-mono font-bold">{done.reference}</span> — {formatCurrency(done.total)}{" "}
            payable. The confirmation and the booking automation have already run.
          </p>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy || !chosen}>
            {busy ? "Taking the booking…" : "Take booking"}
          </Button>
          {chosen && (
            <span className="text-[13px] text-ink-400">
              Priced on the server from {formatCurrency(chosen.pricePerDay)} a day, with the multi-day discount applied.
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
