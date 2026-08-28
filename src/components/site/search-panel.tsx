"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

function isoIn(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The pick-up / drop-off panel from the wireframe, wired to the fleet search.
 * Submitting pushes the criteria into /cars as query params so the result page
 * is linkable and server-rendered.
 */
export function SearchPanel({ locations, className }: { locations: string[]; className?: string }) {
  const router = useRouter();
  const id = useId();
  // Prefer a Dhaka branch as the default - it is the busiest by a wide margin
  // and reads better than whatever happens to sort first alphabetically.
  const defaultLocation = locations.find((l) => l.startsWith("Dhaka")) ?? locations[0] ?? "";
  const [pickupLocation, setPickupLocation] = useState(defaultLocation);
  const [pickupDate, setPickupDate] = useState(isoIn(3));
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffLocation, setDropoffLocation] = useState(defaultLocation);
  const [dropoffDate, setDropoffDate] = useState(isoIn(6));
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (new Date(dropoffDate) <= new Date(pickupDate)) {
      setError("Drop-off has to be after pick-up.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      location: pickupLocation,
      pickup: `${pickupDate}T${pickupTime}`,
      dropoff: `${dropoffDate}T${dropoffTime}`,
      dropoffLocation,
    });
    router.push(`/cars?${params.toString()}`);
  }

  const cell = "flex flex-col gap-1.5 px-5 py-4";
  const label = "text-[13px] font-semibold text-ink-900";
  const control =
    "w-full bg-transparent text-[13px] text-ink-500 outline-none focus-visible:text-ink-900 [color-scheme:light]";

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-2xl border border-line bg-white shadow-[0_28px_70px_-32px_rgba(9,44,76,0.35)]",
        className,
      )}
    >
      <div className="grid gap-px bg-line lg:grid-cols-[1fr_1fr_auto]">
        {/* Pick-up */}
        <div className="bg-white">
          <div className="flex items-center gap-2 px-5 pt-4">
            <span className="grid size-4 place-items-center rounded-full border-[3px] border-brand-400" />
            <span className="text-[13px] font-semibold text-ink-900">Pick - Up</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className={cell}>
              <span className={label}>Locations</span>
              <select
                aria-label="Pick-up location"
                className={control}
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Date</span>
              <input
                id={`${id}-pickup-date`}
                aria-label="Pick-up date"
                type="date"
                min={isoIn(0)}
                className={control}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Time</span>
              <select aria-label="Pick-up time" className={control} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Drop-off */}
        <div className="bg-white">
          <div className="flex items-center gap-2 px-5 pt-4">
            <span className="grid size-4 place-items-center rounded-full border-[3px] border-ink-300" />
            <span className="text-[13px] font-semibold text-ink-900">Drop - Off</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className={cell}>
              <span className={label}>Locations</span>
              <select
                aria-label="Drop-off location"
                className={control}
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Date</span>
              <input
                aria-label="Drop-off date"
                type="date"
                min={pickupDate}
                className={control}
                value={dropoffDate}
                onChange={(e) => setDropoffDate(e.target.value)}
              />
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Time</span>
              <select aria-label="Drop-off time" className={control} value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-white p-3 lg:p-4">
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-8 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,159,67,1)] transition-all hover:bg-brand-500 lg:w-auto"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" strokeLinecap="round" />
            </svg>
            Search
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="border-t border-line px-5 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
