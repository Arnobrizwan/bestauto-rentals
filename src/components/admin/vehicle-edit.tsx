"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Field, Input, Select } from "@/components/ui";
import { FUELS, SEGMENTS, TRANSMISSIONS } from "@/lib/taxonomy";

type Vehicle = {
  slug: string;
  name: string;
  segment: string;
  bodyType: string;
  transmission: string;
  fuel: string;
  pricePerDay: number;
  costPerDay: number;
  location: string;
  unitsTotal: number;
  unitsAvailable: number;
};

/**
 * Editing a car that is already live.
 *
 * The fleet was add-only: a typo in a name or a wrong daily rate was permanent
 * and public, and a car could never be taken off sale. This posts the fields
 * that changed and nothing else, so an edit cannot blank a column it did not
 * touch, and the endpoint revalidates the cached public pages so the change is
 * visible immediately rather than in up to five minutes.
 */
export function VehicleEditForm({
  vehicle,
  branches,
  bodyTypes,
}: {
  vehicle: Vehicle;
  branches: readonly string[];
  bodyTypes: readonly string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch(`/api/vehicles/${vehicle.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save the changes.");
        return;
      }
      setDone("Saved. The public pages have been refreshed.");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /** Retiring a car is refused by the API while bookings reference it. */
  async function retire() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.slug}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not remove the vehicle.");
        return;
      }
      router.push("/admin/vehicles");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Name" className="sm:col-span-2">
          <Input name="name" defaultValue={vehicle.name} required minLength={2} maxLength={120} />
        </Field>

        <Field label="Branch">
          <Select name="location" defaultValue={vehicle.location}>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Body type">
          <Select name="bodyType" defaultValue={vehicle.bodyType}>
            {bodyTypes.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Segment">
          <Select name="segment" defaultValue={vehicle.segment}>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Transmission">
          <Select name="transmission" defaultValue={vehicle.transmission}>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Fuel">
          <Select name="fuel" defaultValue={vehicle.fuel}>
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Price per day (৳)">
          <Input name="pricePerDay" type="number" min={0} step={1} defaultValue={vehicle.pricePerDay} />
        </Field>

        <Field label="Cost per day (৳)" hint="Margin on the dashboard is derived from this.">
          <Input name="costPerDay" type="number" min={0} step={1} defaultValue={vehicle.costPerDay} />
        </Field>

        <Field label="Units total">
          <Input name="unitsTotal" type="number" min={0} max={200} defaultValue={vehicle.unitsTotal} />
        </Field>

        <Field label="Units available" hint="Set to 0 to take the car off sale without losing its history.">
          <Input name="unitsAvailable" type="number" min={0} max={200} defaultValue={vehicle.unitsAvailable} />
        </Field>

        <div className="sm:col-span-2 xl:col-span-3">
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
          {done && (
            <p className="mb-3 rounded-lg bg-success-soft px-3 py-2 text-[13px] font-medium text-success">{done}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void retire()} disabled={busy}>
              Retire this car
            </Button>
            <a
              href={`/cars/${vehicle.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-semibold text-ink-500 underline underline-offset-4 hover:text-ink-900"
            >
              View the public page
            </a>
          </div>
        </div>
      </form>
    </Card>
  );
}
