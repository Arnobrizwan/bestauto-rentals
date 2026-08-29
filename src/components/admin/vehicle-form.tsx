"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { FUELS, SEGMENTS, TRANSMISSIONS } from "@/lib/taxonomy";

/**
 * Adds a model to the fleet.
 *
 * Cost per day sits next to price per day because margin is the number this
 * business actually runs on, and the dashboard derives it from these two —
 * leaving cost out here would silently break every margin figure downstream.
 */
/**
 * The three closed vocabularies come from `@/lib/taxonomy`, which is the same
 * module the create endpoint validates against — the dropdown cannot offer a
 * value the API would reject, which is exactly what it used to do with
 * "popular", nor omit one it accepts, which is what it did with Octane.
 *
 * `bodyType` is free text on the vehicle, so its options are passed in: the
 * page unions the canonical list with what the fleet is actually running.
 */
export function VehicleForm({ branches, bodyTypes }: { branches: readonly string[]; bodyTypes: readonly string[] }) {
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
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add the vehicle.");
        return;
      }
      setDone(`${data.vehicle.name} is live at /cars/${data.vehicle.slug}.`);
      (event.target as HTMLFormElement).reset();
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
        <Field label="Name" className="sm:col-span-2" hint="Becomes the public URL slug.">
          <Input name="name" required minLength={2} maxLength={120} placeholder="Toyota Premio" />
        </Field>
        <Field label="Year">
          <Input name="year" type="number" required min={1990} max={2100} defaultValue={2021} />
        </Field>

        <Field label="Brand">
          <Input name="brand" required minLength={2} maxLength={60} placeholder="Toyota" />
        </Field>
        <Field label="Model">
          <Input name="model" required maxLength={60} placeholder="Premio" />
        </Field>
        <Field label="Body type">
          <Select name="bodyType" defaultValue="Sedan">
            {bodyTypes.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>

        <Field label="Segment">
          <Select name="segment" defaultValue="popular">
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transmission">
          <Select name="transmission" defaultValue="Automatic">
            {TRANSMISSIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fuel">
          <Select name="fuel" defaultValue="Petrol">
            {FUELS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Field>

        <Field label="Seats">
          <Input name="seats" type="number" required min={2} max={15} defaultValue={5} />
        </Field>
        <Field label="Doors">
          <Input name="doors" type="number" required min={2} max={6} defaultValue={4} />
        </Field>
        <Field label="Bags">
          <Input name="bags" type="number" required min={0} max={12} defaultValue={2} />
        </Field>

        <Field label="Price per day (৳)" hint="What the customer pays, with a driver.">
          <Input name="pricePerDay" type="number" required min={0} step={100} defaultValue={5000} />
        </Field>
        <Field label="Cost per day (৳)" hint="Drives every margin figure on the dashboard.">
          <Input name="costPerDay" type="number" required min={0} step={100} defaultValue={2200} />
        </Field>
        <Field label="Units">
          <Input name="unitsTotal" type="number" required min={1} max={200} defaultValue={4} />
        </Field>

        <Field label="Home branch">
          <Select name="location" defaultValue={branches[0]}>
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Photo URL" className="sm:col-span-2">
          <Input name="imageUrl" type="url" required maxLength={400} placeholder="https://images.unsplash.com/…" />
        </Field>

        <Field label="Description" className="sm:col-span-2 xl:col-span-3">
          <Textarea name="description" rows={3} maxLength={1200} placeholder="How this car is usually hired." />
        </Field>

        {error && (
          <p role="alert" className="text-[13px] text-danger sm:col-span-2 xl:col-span-3">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-xl bg-success-soft px-4 py-3 text-[13px] text-success sm:col-span-2 xl:col-span-3">
            {done}
          </p>
        )}

        <div className="sm:col-span-2 xl:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add to fleet"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
